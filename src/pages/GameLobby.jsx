import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { soundService } from '../services/soundService';
import { notificationService } from '../services/notificationService';
import * as gameService from '../services/gameService';
import mrMonopolyImg from '../mrMonopoly.png';
import { MONOPOLY_TOKENS, TokenIcon } from '../utils/monopolyTokens';
import './GameLobby.css';

// Generate shareable join link
const getJoinLink = (code) => {
  const baseUrl = window.location.origin;
  return `${baseUrl}/join/${code}`;
};

function GameLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code } = useParams();
  const user = authService.getCurrentUser();
  
  const [game, setGame] = useState(location.state?.game || null);
  const [isLoading, setIsLoading] = useState(!location.state?.game);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editStartingBalance, setEditStartingBalance] = useState(1500);
  const [editGoSalary, setEditGoSalary] = useState(200);
  const [editMaxPlayers, setEditMaxPlayers] = useState(4);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [notifiedFriends, setNotifiedFriends] = useState([]);

  // Load game data
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

  // Background refresh for polling (no loading indicator)
  const refreshInBackground = useCallback(async () => {
    try {
      const data = await gameService.getGame(code);
      setGame(data.game);
      
      // If game has started, navigate all players to the game session
      if (data.game.status === 'in_progress') {
        soundService.playGameStart();
        navigate(`/game/${code}`, { state: { game: data.game } });
      }
    } catch (err) {
      console.warn('Background refresh failed:', err.message);
    }
  }, [code, navigate]);

  useEffect(() => {
    if (!game && code) {
      loadGame();
    }
  }, [game, code, loadGame]);

  // Poll for updates every 2 seconds (in a real app, use WebSockets)
  useEffect(() => {
    if (game && game.status === 'waiting') {
      const interval = setInterval(refreshInBackground, 2000);
      return () => clearInterval(interval);
    }
  }, [game, refreshInBackground]);

  // Handle browser back button - leave game before navigating
  useEffect(() => {
    const handlePopState = async (e) => {
      e.preventDefault();
      if (game) {
        try {
          await gameService.leaveGame(game._id || game.id);
        } catch (err) {
          console.warn('Failed to leave game on back:', err.message);
        }
      }
      navigate('/dashboard', { replace: true });
    };

    // Push a state to history so we can intercept back
    window.history.pushState({ inLobby: true }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [game, navigate]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isHost = String(game?.host?._id || game?.host || '') === String(user?._id || '');
  const currentPlayer = game?.players?.find(p => 
    (p.user?._id || p.user) === user._id
  );
  const allReady = game?.players?.every(p => p.isReady);
  const canStart = isHost && allReady && game?.players?.length >= 2;

  const copyCode = () => {
    navigator.clipboard.writeText(game.code);
    setCopied(true);
    soundService.playSuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleReady = async () => {
    try {
      soundService.playClick();
      const data = await gameService.toggleReady(game._id || game.id);
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartGame = async () => {
    try {
      setIsStarting(true);
      const latest = await gameService.getGame(code);
      const latestGame = latest.game;
      setGame(latestGame);

      if (latestGame.status !== 'waiting') {
        navigate(`/game/${latestGame.code}`, { state: { game: latestGame } });
        return;
      }

      const latestAllReady = latestGame.players?.every((player) => player.isReady);
      if (!latestAllReady) {
        setError('Not all players are ready yet.');
        setIsStarting(false);
        return;
      }

      soundService.playGameStart();
      const data = await gameService.startGame(latestGame._id || latestGame.id);
      navigate(`/game/${data.game.code}`, { state: { game: data.game } });
    } catch (err) {
      setError(err.message);
      setIsStarting(false);
    }
  };

  const handleLeaveGame = async () => {
    try {
      soundService.playClick();
      await gameService.leaveGame(game._id || game.id);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getColorClass = (color) => {
    return `player-color-${color || 'gray'}`;
  };

  const openInviteModal = async () => {
    soundService.playClick();
    setShowInviteModal(true);
    setFriendsLoading(true);
    try {
      const data = await authService.getFriends();
      setFriends(data.friends || []);
    } catch (err) {
      console.error('Failed to load friends:', err);
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(game?.code || '');
    setInviteCopied(true);
    soundService.playSuccess();
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const handleShareToFriend = async (friend) => {
    soundService.playClick();
    try {
      // Send notification to friend via backend
      await authService.sendGameInvite(friend._id, game?.id, game?.code, game?.name);
      soundService.playSuccess();
      // Mark as notified
      setNotifiedFriends(prev => [...prev, friend._id]);
      setError('');
    } catch (err) {
      // Fallback to clipboard if notification fails
      const message = `Join my MonoPay game! Code: ${game?.code}\n${getJoinLink(game?.code)}`;
      navigator.clipboard.writeText(message);
      soundService.playSuccess();
    }
  };

  const handleCopyJoinLink = () => {
    const link = getJoinLink(game?.code);
    navigator.clipboard.writeText(link);
    setInviteCopied(true);
    soundService.playSuccess();
    setTimeout(() => setInviteCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${game?.name || 'my Monopoly game'}!`,
          text: `Join my MonoPay game! Code: ${game?.code}`,
          url: getJoinLink(game?.code),
        });
        soundService.playSuccess();
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyJoinLink();
        }
      }
    } else {
      handleCopyJoinLink();
    }
  };

  const handleSelectToken = async (tokenId) => {
    try {
      soundService.playClick();
      const data = await gameService.selectToken(game._id || game.id, tokenId);
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) {
      setError(err.message);
    }
  };

  const takenTokens = game?.players?.filter(p => p.token && (p.user?._id || p.user) !== user._id).map(p => p.token) || [];
  const myToken = currentPlayer?.token;

  const openSettingsModal = () => {
    setEditStartingBalance(game?.startingBalance || 1500);
    setEditGoSalary(game?.goSalary || 200);
    setEditMaxPlayers(game?.maxPlayers || 4);
    setShowSettingsModal(true);
    soundService.playClick();
  };

  const handleSaveSettings = async () => {
    try {
      soundService.playSuccess();
      const data = await gameService.updateGameSettings(game._id || game.id, {
        startingBalance: editStartingBalance,
        goSalary: editGoSalary,
        maxPlayers: editMaxPlayers,
      });
      setGame(prev => ({
        ...prev,
        startingBalance: editStartingBalance,
        goSalary: editGoSalary,
        maxPlayers: editMaxPlayers,
        ...data.game
      }));
      setShowSettingsModal(false);
    } catch (err) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="game-lobby">
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

  if (error && !game) {
    return (
      <div className="game-lobby">
        <div className="bg-blob bg-blob--pink"></div>
        <div className="bg-blob bg-blob--beige"></div>
        <div className="bg-blob bg-blob--purple"></div>
        <div className="error-container">
          <h2>Oops!</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-lobby">
      {/* Background Blobs */}
      <div className="bg-blob bg-blob--pink"></div>
      <div className="bg-blob bg-blob--beige"></div>
      <div className="bg-blob bg-blob--purple"></div>

      {/* Header */}
      <header className="lobby-header">
        <button className="leave-btn" onClick={handleLeaveGame}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Leave</span>
        </button>
        <div className="lobby-brand">
          <img src={mrMonopolyImg} alt="Mr. Monopoly" className="brand-logo" />
          <span className="brand-title">Mono<span>Pay</span></span>
        </div>
        <button className="share-lobby-btn" onClick={openInviteModal} title="Share & Invite">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="lobby-content">
        {/* Game Info Card */}
        <div className="game-info-card">
          <h1 className="game-name">{game?.name}</h1>
          <div className="game-code-section">
            <span className="code-label">Game Code</span>
            <div className="code-display" onClick={copyCode}>
              <span className="code-text">{game?.code}</span>
              <button className="copy-btn">
                {copied ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                )}
              </button>
            </div>
            <span className="code-hint">Share this code with friends</span>
          </div>
          <div className="game-settings">
            <div className="setting">
              <span className="setting-label">Starting Balance</span>
              <span className="setting-value">£{game?.startingBalance?.toLocaleString()}</span>
            </div>
            <div className="setting">
              <span className="setting-label">GO Salary</span>
              <span className="setting-value">£{game?.goSalary}</span>
            </div>
            <div className="setting">
              <span className="setting-label">Max Players</span>
              <span className="setting-value">{game?.maxPlayers}</span>
            </div>
            {isHost && (
              <button className="edit-settings-btn" onClick={openSettingsModal} title="Edit Settings">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Token Picker */}
        <div className="token-picker-section">
          <h2>Choose Your Token</h2>
          <p className="token-hint">Pick your Monopoly piece for this game</p>
          <div className="token-grid">
            {MONOPOLY_TOKENS.map(token => {
              const isTaken = takenTokens.includes(token.id);
              const isSelected = myToken === token.id;
              const takenBy = isTaken ? game?.players?.find(p => p.token === token.id)?.user?.displayName : null;
              return (
                <button
                  key={token.id}
                  className={`token-btn ${isSelected ? 'selected' : ''} ${isTaken ? 'taken' : ''}`}
                  onClick={() => !isTaken && handleSelectToken(token.id)}
                  disabled={isTaken}
                  title={isTaken ? `Taken by ${takenBy}` : token.label}
                >
                  <TokenIcon token={token.id} size={32} color={isSelected ? '#8b6914' : isTaken ? '#bbb' : '#555'} />
                  {isTaken && <span className="token-taken-badge">Taken</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Players Section */}
        <div className="players-section">
          <div className="players-header">
            <h2>Players</h2>
            <span className="player-count">{game?.players?.length || 0} / {game?.maxPlayers}</span>
          </div>
          
          <div className="players-grid">
            {game?.players?.map((player, index) => (
              <div 
                key={player.user?._id || index} 
                className={`player-card ${player.isReady ? 'ready' : 'not-ready'}`}
              >
                <div className="player-avatar">
                  <span className="player-initials">{getInitials(player.user?.displayName || player.user?.username)}</span>
                  {player.user?.avatar && (
                    <img 
                      src={player.user.avatar} 
                      alt="" 
                      onError={(e) => { e.target.style.opacity = '0'; e.target.style.visibility = 'hidden'; }}
                    />
                  )}
                  {player.isHost && (
                    <div className="host-badge" title="Host">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="player-info">
                  <span className="player-name">{player.user?.displayName || player.user?.username}</span>
                  <span className="player-status">
                    {player.token && <span className="player-token-badge">{MONOPOLY_TOKENS.find(t => t.id === player.token)?.emoji || ''} </span>}
                    {player.isReady ? '✓ Ready' : 'Not Ready'}
                  </span>
                </div>
              </div>
            ))}
            
            {/* Empty slots - clickable to invite */}
            {Array.from({ length: (game?.maxPlayers || 8) - (game?.players?.length || 0) }).map((_, index) => (
              <div key={`empty-${index}`} className="player-card empty" onClick={openInviteModal}>
                <div className="player-avatar empty">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <line x1="20" y1="8" x2="20" y2="14"/>
                    <line x1="23" y1="11" x2="17" y2="11"/>
                  </svg>
                </div>
                <div className="player-info">
                  <span className="player-name">Invite Friend</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="error-message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="lobby-actions">
          {!isHost && (
            <button 
              className={`btn-ready ${currentPlayer?.isReady ? 'ready' : ''}`}
              onClick={handleToggleReady}
            >
              {currentPlayer?.isReady ? 'Not Ready' : "I'm Ready!"}
            </button>
          )}
          
          {isHost && (
            <>
              <button 
                className="btn-start"
                onClick={handleStartGame}
                disabled={!canStart || isStarting}
              >
                {isStarting ? 'Starting...' : !allReady ? 'Waiting for players...' : game?.players?.length < 2 ? 'Need 2+ players' : 'Start Game'}
              </button>
              {isHost && !currentPlayer?.isReady && (
                <button 
                  className={`btn-ready ${currentPlayer?.isReady ? 'ready' : ''}`}
                  onClick={handleToggleReady}
                >
                  {currentPlayer?.isReady ? 'Not Ready' : "I'm Ready!"}
                </button>
              )}
            </>
          )}
        </div>
      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="settings-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Game Settings</h2>
              <button className="modal-close" onClick={() => setShowSettingsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Starting Balance</label>
                <select 
                  value={editStartingBalance} 
                  onChange={(e) => { soundService.playClick(); setEditStartingBalance(parseInt(e.target.value)); }}
                >
                  <option value="1000">£1,000</option>
                  <option value="1500">£1,500</option>
                  <option value="2000">£2,000</option>
                  <option value="2500">£2,500</option>
                  <option value="3000">£3,000</option>
                </select>
              </div>
              <div className="form-group">
                <label>GO Salary</label>
                <select 
                  value={editGoSalary} 
                  onChange={(e) => { soundService.playClick(); setEditGoSalary(parseInt(e.target.value)); }}
                >
                  <option value="100">£100</option>
                  <option value="200">£200</option>
                  <option value="300">£300</option>
                  <option value="400">£400</option>
                  <option value="500">£500</option>
                </select>
              </div>
              <div className="form-group">
                <label>Max Players</label>
                <select 
                  value={editMaxPlayers} 
                  onChange={(e) => { soundService.playClick(); setEditMaxPlayers(parseInt(e.target.value)); }}
                  disabled={game?.players?.length > 2}
                >
                  {[2, 3, 4, 5, 6, 7, 8].filter(n => n >= (game?.players?.length || 1)).map(n => (
                    <option key={n} value={n}>{n} Players</option>
                  ))}
                </select>
                {game?.players?.length > 2 && (
                  <span className="hint-text">Cannot reduce below current player count</span>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowSettingsModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveSettings}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="invite-modal" onClick={e => e.stopPropagation()}>
            <div className="invite-modal-header">
              <h2>Invite Friends</h2>
              <button className="modal-close" onClick={() => setShowInviteModal(false)}>×</button>
            </div>
            
            <div className="invite-code-box">
              <span className="invite-code-label">Share Game Code</span>
              <div className="invite-code-display" onClick={handleCopyInviteCode}>
                <span className="invite-code-text">{game?.code}</span>
                <button className="invite-copy-btn">
                  {inviteCopied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>
              <span className="invite-code-hint">{inviteCopied ? 'Copied!' : 'Tap to copy code'}</span>
              
              {/* Share Link Button */}
              <button className="share-link-btn" onClick={handleNativeShare}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share Join Link
              </button>
            </div>

            <div className="invite-friends-list">
              <span className="invite-section-label">Your Friends</span>
              {friendsLoading ? (
                <div className="invite-loading">
                  <div className="spinner-small"></div>
                  <span>Loading friends...</span>
                </div>
              ) : friends.length > 0 ? (
                <div className="invite-friends-scroll">
                  {friends.map((friend, index) => {
                    const friendAvatar = (friend.avatar && friend.avatar.trim()) || null;
                    const isInCurrentGame = game?.players?.some(p => 
                      (p.user?._id || p.user) === friend._id
                    );
                    return (
                      <div key={friend._id || index} className={`invite-friend-item ${isInCurrentGame ? 'in-game' : ''}`}>
                        <div className="invite-friend-avatar">
                          <span>{getInitials(friend.displayName || friend.username)}</span>
                          {friendAvatar && (
                            <img 
                              src={friendAvatar} 
                              alt="" 
                              onError={(e) => { e.target.style.opacity = '0'; }}
                            />
                          )}
                        </div>
                        <div className="invite-friend-info">
                          <span className="invite-friend-name">{friend.displayName || friend.username}</span>
                          <span className="invite-friend-uid">@{friend.username}</span>
                        </div>
                        {isInCurrentGame ? (
                          <span className="invite-joined-badge">Joined</span>
                        ) : notifiedFriends.includes(friend._id) ? (
                          <span className="invite-notified-badge">Notified</span>
                        ) : (
                          <button 
                            className="invite-send-btn notify"
                            onClick={() => handleShareToFriend(friend)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                            </svg>
                            Notify
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="invite-empty">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <p>No friends yet</p>
                  <span>Add friends from your dashboard to invite them</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameLobby;
