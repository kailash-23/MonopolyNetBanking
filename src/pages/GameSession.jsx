import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { soundService } from '../services/soundService';
import * as gameService from '../services/gameService';
import mrMonopolyImg from '../mrMonopoly.png';
import './GameSession.css';

function GameSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code } = useParams();
  const user = authService.getCurrentUser();
  
  const [game, setGame] = useState(location.state?.game || null);
  const [isLoading, setIsLoading] = useState(!location.state?.game);
  const [error, setError] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bankAction, setBankAction] = useState('receive'); // 'receive' or 'pay'
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [hasPendingGoRequest, setHasPendingGoRequest] = useState(false);
  const [hasPendingBankRequest, setHasPendingBankRequest] = useState(false);

  // Quick amounts for bank
  const quickAmounts = [50, 100, 200, 500, 1000];

  // Load game data (only for initial load)
  const loadGame = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await gameService.getGame(code);
      setGame(data.game);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [code]);

  // Background refresh - no loading indicator, no page flicker
  const refreshInBackground = useCallback(async () => {
    try {
      const data = await gameService.getGame(code);
      // Only update if game data actually changed (compare player balances)
      setGame(prevGame => {
        if (!prevGame) return data.game;
        // Check if anything important changed
        const prevBalances = prevGame.players?.map(p => p.balance).join(',');
        const newBalances = data.game.players?.map(p => p.balance).join(',');
        const statusChanged = prevGame.status !== data.game.status;
        
        if (prevBalances !== newBalances || statusChanged) {
          return data.game;
        }
        return prevGame; // No change, don't trigger re-render
      });
      
      // Update pending approvals
      const pending = data.game.pendingApprovals?.filter(r => r.status === 'pending') || [];
      setPendingApprovals(pending);
      
      // Check if current user has a pending GO request
      const userHasPendingGo = pending.some(r => 
        (r.player?._id || r.player) === user?._id && r.type === 'go_salary'
      );
      setHasPendingGoRequest(userHasPendingGo);
      
      // Check if current user has a pending bank receive request
      const userHasPendingBank = pending.some(r => 
        (r.player?._id || r.player) === user?._id && r.type === 'bank_receive'
      );
      setHasPendingBankRequest(userHasPendingBank);
      
      // Navigate away if game ended
      if (data.game.status === 'completed') {
        navigate('/dashboard');
      }
    } catch (err) {
      console.warn('Background refresh failed:', err.message);
    }
  }, [code, navigate, user?._id]);

  useEffect(() => {
    if (!game && code) {
      loadGame();
    }
  }, [game, code, loadGame]);

  // Poll for updates in background (every 3 seconds - balanced for performance)
  useEffect(() => {
    if (game && game.status === 'in_progress') {
      const interval = setInterval(refreshInBackground, 500);
      return () => clearInterval(interval);
    }
  }, [game, refreshInBackground]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isHost = game?.host?._id === user._id || game?.host === user._id;
  const currentPlayer = game?.players?.find(p => 
    (p.user?._id || p.user) === user._id
  );

  const handleTransfer = async () => {
    if (!selectedPlayer || !amount || parseInt(amount) <= 0) return;
    
    const transferAmount = parseInt(amount);
    const recipientId = selectedPlayer.user?._id || selectedPlayer.user;
    
    // Optimistic UI update - show change immediately
    setGame(prev => ({
      ...prev,
      players: prev.players.map(p => {
        const playerId = p.user?._id || p.user;
        if (playerId === user._id) {
          return { ...p, balance: p.balance - transferAmount };
        }
        if (playerId === recipientId) {
          return { ...p, balance: p.balance + transferAmount };
        }
        return p;
      })
    }));
    
    // Close modal immediately for snappy feel
    setShowTransferModal(false);
    setSelectedPlayer(null);
    setAmount('');
    setDescription('');
    soundService.playSuccess();
    
    try {
      setIsProcessing(true);
      const data = await gameService.transferMoney(
        game.id,
        recipientId,
        transferAmount,
        'transfer',
        description || `Transfer to ${selectedPlayer.user?.displayName || selectedPlayer.user?.username}`
      );
      // Update with server response to ensure accuracy
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) {
      setError(err.message);
      // Revert on error - refresh from server
      refreshInBackground();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBankTransaction = async () => {
    if (!amount || parseInt(amount) <= 0) return;
    
    const transactionAmount = parseInt(amount);
    
    // For bank receive, require approval
    if (bankAction === 'receive') {
      if (hasPendingBankRequest) {
        setError('You already have a pending bank receive request');
        return;
      }
      
      // Close modal immediately
      setShowBankModal(false);
      setAmount('');
      soundService.playClick();
      
      try {
        const data = await gameService.requestBankReceive(
          game.id, 
          transactionAmount, 
          description || 'Received from bank'
        );
        setHasPendingBankRequest(true);
        if (data.pendingApprovals) {
          setPendingApprovals(data.pendingApprovals);
        }
        setDescription('');
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    
    // For bank pay, process directly (no approval needed)
    // Optimistic UI update
    setGame(prev => ({
      ...prev,
      players: prev.players.map(p => {
        const playerId = p.user?._id || p.user;
        if (playerId === user._id) {
          return { ...p, balance: p.balance - transactionAmount };
        }
        return p;
      })
    }));
    
    // Close modal immediately
    setShowBankModal(false);
    setAmount('');
    setDescription('');
    soundService.playSuccess();
    
    try {
      setIsProcessing(true);
      const data = await gameService.transferMoney(
        game.id,
        null,
        transactionAmount,
        'bank_pay',
        description || 'Paid to bank'
      );
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) {
      setError(err.message);
      refreshInBackground();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCollectGo = async () => {
    if (hasPendingGoRequest) {
      setError('You already have a pending GO request');
      return;
    }
    
    try {
      soundService.playClick();
      const data = await gameService.requestGoSalary(game.id);
      setHasPendingGoRequest(true);
      if (data.pendingApprovals) {
        setPendingApprovals(data.pendingApprovals);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApproveRequest = async (requestId, approved) => {
    try {
      soundService.playClick();
      const data = await gameService.approveRequest(game.id, requestId, approved);
      if (data.players) {
        setGame(prev => ({ ...prev, players: data.players }));
      }
      if (data.pendingApprovals) {
        setPendingApprovals(data.pendingApprovals);
      }
      if (approved) {
        soundService.playSuccess();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEndGame = async () => {
    try {
      soundService.playClick();
      await gameService.endGame(game.id);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLeaveGame = async () => {
    try {
      soundService.playClick();
      await gameService.leaveGame(game.id);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatMoney = (amount) => {
    return `$${amount?.toLocaleString() || 0}`;
  };

  const otherPlayers = game?.players?.filter(p => 
    (p.user?._id || p.user) !== user._id
  ) || [];

  if (isLoading) {
    return (
      <div className="game-session">
        <div className="bg-blob bg-blob--pink"></div>
        <div className="bg-blob bg-blob--beige"></div>
        <div className="bg-blob bg-blob--purple"></div>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  if (game?.status === 'finished') {
    return (
      <div className="game-session">
        <div className="bg-blob bg-blob--pink"></div>
        <div className="bg-blob bg-blob--beige"></div>
        <div className="bg-blob bg-blob--purple"></div>
        <div className="game-ended-container">
          <h1>Game Ended</h1>
          <p>The game has been finished.</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-session">
      {/* Background Blobs */}
      <div className="bg-blob bg-blob--pink"></div>
      <div className="bg-blob bg-blob--beige"></div>
      <div className="bg-blob bg-blob--purple"></div>

      {/* Header */}
      <header className="session-header">
        <div className="header-left">
          <span className="game-code-badge">{game?.code}</span>
        </div>
        <div className="header-center">
          <img src={mrMonopolyImg} alt="" className="header-logo" />
          <span className="header-title">{game?.name}</span>
        </div>
        <button className="menu-btn" onClick={() => setShowEndConfirm(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </header>

      {/* Your Balance Card */}
      <div className="balance-card">
        <div className="balance-header">
          <span className="balance-label">Your Balance</span>
          <div className={`color-dot ${currentPlayer?.color}`}></div>
        </div>
        <div className="balance-amount">{formatMoney(currentPlayer?.balance)}</div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button 
          className={`quick-action collect-go ${hasPendingGoRequest ? 'pending' : ''}`} 
          onClick={handleCollectGo}
          disabled={hasPendingGoRequest}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
          <span>{hasPendingGoRequest ? 'Pending...' : 'Collect GO'}</span>
          <span className="quick-amount">+${game?.goSalary}</span>
        </button>
        <button className="quick-action bank" onClick={() => { soundService.playClick(); setShowBankModal(true); }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Bank</span>
        </button>
      </div>

      {/* Pending Approval Requests (shown to designated approver) */}
      {pendingApprovals.filter(r => (r.approver?._id || r.approver) === user._id).length > 0 && (
        <div className="pending-requests-section">
          <h3>Pending Approval Requests</h3>
          <div className="pending-requests-list">
            {pendingApprovals
              .filter(r => (r.approver?._id || r.approver) === user._id)
              .map((request) => (
              <div key={request._id} className="pending-request-item">
                <div className="request-player-info">
                  <div className="request-avatar">
                    {request.player?.avatar ? (
                      <img src={request.player.avatar} alt="" />
                    ) : (
                      <span>{getInitials(request.player?.displayName || request.player?.username)}</span>
                    )}
                  </div>
                  <div className="request-details">
                    <span className="request-player-name">{request.player?.displayName || request.player?.username}</span>
                    <span className="request-amount">
                      {request.type === 'go_salary' ? 'Collect GO' : 'Bank Receive'} +${request.amount}
                    </span>
                    {request.description && (
                      <span className="request-description">{request.description}</span>
                    )}
                  </div>
                </div>
                <div className="request-actions">
                  <button 
                    className="btn-approve" 
                    onClick={() => handleApproveRequest(request._id, true)}
                    title="Approve"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <button 
                    className="btn-deny" 
                    onClick={() => handleApproveRequest(request._id, false)}
                    title="Deny"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Players */}
      <div className="players-section">
        <h3>Pay a Player</h3>
        <div className="players-list">
          {otherPlayers.map((player, index) => (
            <button
              key={player.user?._id || index}
              className="player-row"
              onClick={() => {
                soundService.playClick();
                setSelectedPlayer(player);
                setShowTransferModal(true);
              }}
            >
              <div className="player-avatar">
                {player.user?.avatar ? (
                  <img src={player.user.avatar} alt="" />
                ) : (
                  <span>{getInitials(player.user?.displayName || player.user?.username)}</span>
                )}
                <div className={`color-dot ${player.color}`}></div>
              </div>
              <div className="player-details">
                <span className="player-name">{player.user?.displayName || player.user?.username}</span>
                <span className="player-balance">{formatMoney(player.balance)}</span>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedPlayer && (
        <div className="modal-overlay" onClick={() => { setShowTransferModal(false); setSelectedPlayer(null); }}>
          <div className="modal transfer-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Pay {selectedPlayer.user?.displayName || selectedPlayer.user?.username}</h2>
              <button className="modal-close" onClick={() => { setShowTransferModal(false); setSelectedPlayer(null); }}>×</button>
            </div>
            <div className="modal-body">
              <div className="recipient-info">
                <div className="recipient-avatar">
                  {selectedPlayer.user?.avatar ? (
                    <img src={selectedPlayer.user.avatar} alt="" />
                  ) : (
                    <span>{getInitials(selectedPlayer.user?.displayName)}</span>
                  )}
                </div>
                <span>Their balance: {formatMoney(selectedPlayer.balance)}</span>
              </div>
              
              <div className="form-group">
                <label>Amount</label>
                <div className="amount-input-wrapper">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    min="1"
                    max={currentPlayer?.balance}
                  />
                </div>
                <span className="balance-hint">Your balance: {formatMoney(currentPlayer?.balance)}</span>
              </div>

              <div className="quick-amounts">
                {quickAmounts.map(amt => (
                  <button
                    key={amt}
                    className={`quick-amt-btn ${amount === String(amt) ? 'selected' : ''}`}
                    onClick={() => setAmount(String(amt))}
                    disabled={amt > (currentPlayer?.balance || 0)}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label>Note (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Rent, trade, etc."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowTransferModal(false); setSelectedPlayer(null); }}>Cancel</button>
              <button 
                className="btn-primary" 
                onClick={handleTransfer}
                disabled={!amount || parseInt(amount) <= 0 || parseInt(amount) > (currentPlayer?.balance || 0) || isProcessing}
              >
                {isProcessing ? 'Sending...' : `Pay ${formatMoney(parseInt(amount) || 0)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Modal */}
      {showBankModal && (
        <div className="modal-overlay" onClick={() => setShowBankModal(false)}>
          <div className="modal bank-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bank Transaction</h2>
              <button className="modal-close" onClick={() => setShowBankModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="bank-tabs">
                <button 
                  className={`bank-tab ${bankAction === 'receive' ? 'active' : ''}`}
                  onClick={() => setBankAction('receive')}
                >
                  Receive
                </button>
                <button 
                  className={`bank-tab ${bankAction === 'pay' ? 'active' : ''}`}
                  onClick={() => setBankAction('pay')}
                >
                  Pay
                </button>
              </div>

              <div className="form-group">
                <label>Amount</label>
                <div className="amount-input-wrapper">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    min="1"
                  />
                </div>
              </div>

              <div className="quick-amounts">
                {[50, 100, 200, 500, 1000, 2000].map(amt => (
                  <button
                    key={amt}
                    className={`quick-amt-btn ${amount === String(amt) ? 'selected' : ''}`}
                    onClick={() => setAmount(String(amt))}
                    disabled={bankAction === 'pay' && amt > (currentPlayer?.balance || 0)}
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label>Reason (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={bankAction === 'receive' ? 'Property sale, chance card, etc.' : 'Tax, fine, purchase, etc.'}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBankModal(false)}>Cancel</button>
              <button 
                className={`btn-primary ${bankAction === 'pay' ? 'pay' : 'receive'}`}
                onClick={handleBankTransaction}
                disabled={!amount || parseInt(amount) <= 0 || (bankAction === 'pay' && parseInt(amount) > (currentPlayer?.balance || 0)) || isProcessing || (bankAction === 'receive' && hasPendingBankRequest)}
              >
                {isProcessing ? 'Processing...' : 
                  bankAction === 'receive' 
                    ? (hasPendingBankRequest ? 'Request Pending...' : `Request ${formatMoney(parseInt(amount) || 0)}`)
                    : `Pay ${formatMoney(parseInt(amount) || 0)}`
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Game Confirm */}
      {showEndConfirm && (
        <div className="modal-overlay" onClick={() => setShowEndConfirm(false)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Game Menu</h2>
              <button className="modal-close" onClick={() => setShowEndConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <button className="menu-action" onClick={handleLeaveGame}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Leave Game
              </button>
              {isHost && (
                <button className="menu-action danger" onClick={handleEndGame}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>
                  </svg>
                  End Game for Everyone
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameSession;
