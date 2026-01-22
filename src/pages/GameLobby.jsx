import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { soundService } from '../services/soundService';
import * as gameService from '../services/gameService';
import mrMonopolyImg from '../mrMonopoly.png';
import './GameLobby.css';

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

  useEffect(() => {
    if (!game && code) {
      loadGame();
    }
  }, [game, code, loadGame]);

  // Poll for updates every 3 seconds (in a real app, use WebSockets)
  useEffect(() => {
    if (game && game.status === 'waiting') {
      const interval = setInterval(loadGame, 3000);
      return () => clearInterval(interval);
    }
  }, [game, loadGame]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const isHost = game?.host?._id === user._id || game?.host === user._id;
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
      const data = await gameService.toggleReady(game.id);
      setGame(prev => ({ ...prev, players: data.players }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStartGame = async () => {
    try {
      setIsStarting(true);
      soundService.playGameStart();
      const data = await gameService.startGame(game.id);
      navigate(`/game/${game.code}`, { state: { game: data.game } });
    } catch (err) {
      setError(err.message);
      setIsStarting(false);
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

  const getColorClass = (color) => {
    return `player-color-${color || 'gray'}`;
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
        <button className="back-btn" onClick={handleLeaveGame}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Leave
        </button>
        <div className="lobby-brand">
          <img src={mrMonopolyImg} alt="Mr. Monopoly" className="brand-logo" />
          <span className="brand-title">Mono<span>Pay</span></span>
        </div>
        <div className="header-spacer"></div>
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
              <span className="setting-value">${game?.startingBalance?.toLocaleString()}</span>
            </div>
            <div className="setting">
              <span className="setting-label">GO Salary</span>
              <span className="setting-value">${game?.goSalary}</span>
            </div>
            <div className="setting">
              <span className="setting-label">Max Players</span>
              <span className="setting-value">{game?.maxPlayers}</span>
            </div>
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
                className={`player-card ${player.isReady ? 'ready' : ''} ${getColorClass(player.color)}`}
              >
                <div className="player-avatar">
                  {player.user?.avatar ? (
                    <img src={player.user.avatar} alt="" />
                  ) : (
                    <span>{getInitials(player.user?.displayName || player.user?.username)}</span>
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
                    {player.isReady ? '✓ Ready' : 'Not Ready'}
                  </span>
                </div>
                <div className={`color-indicator ${player.color}`}></div>
              </div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: (game?.maxPlayers || 8) - (game?.players?.length || 0) }).map((_, index) => (
              <div key={`empty-${index}`} className="player-card empty">
                <div className="player-avatar empty">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </div>
                <div className="player-info">
                  <span className="player-name">Waiting...</span>
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
    </div>
  );
}

export default GameLobby;
