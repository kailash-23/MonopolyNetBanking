import React, { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { soundService } from '../services/soundService';
import * as gameService from '../services/gameService';
import mrMonopolyImg from '../mrMonopoly.png';
import './Dashboard.css';

// Monopoly editions
const monopolyEditions = [
  { id: 'deluxe', name: 'Deluxe Edition', available: true },
  { id: 'classic', name: 'Classic Edition', available: false },
  { id: 'mega', name: 'Mega Edition', available: false },
  { id: 'junior', name: 'Junior Edition', available: false },
];

function Dashboard() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const profileMenuRef = useRef(null);
  
  // Get user avatar - check for valid URL
  const userAvatar = (user?.avatar && user.avatar.trim()) || (user?.picture && user.picture.trim()) || null;
  
  const [showHostModal, setShowHostModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedEdition, setSelectedEdition] = useState('deluxe');
  const [gameCode, setGameCode] = useState('');
  const [gameName, setGameName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [startingBalance, setStartingBalance] = useState(1500);
  const [stats, setStats] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [friends, setFriends] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  // Load stats from MongoDB
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await authService.getStats();
        setStats(data.stats);
        setGameHistory(data.gameHistory || []);
      } catch (error) {
        console.error('Failed to load stats:', error);
        setStats({
          gamesPlayed: 0,
          gamesWon: 0,
          winRate: '0%',
          totalEarnings: 0,
        });
      } finally {
        setIsLoading(false);
      }
    };

    const loadFriendRequests = async () => {
      try {
        const data = await authService.getFriends();
        setPendingRequests(data.pendingReceived?.length || 0);
        setFriends(data.friends || []);
      } catch (error) {
        console.error('Failed to load friend requests:', error);
      }
    };

    if (user) {
      loadStats();
      loadFriendRequests();
    }
  }, [user]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.isProfileComplete === false) {
    return <Navigate to="/profile-setup" replace />;
  }

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '$0';
    const prefix = amount >= 0 ? '+' : '';
    return `${prefix}$${Math.abs(amount).toLocaleString()}`;
  };

  const handleLogout = () => {
    soundService.playClick();
    authService.signOut();
    navigate('/');
  };

  const handleCreateGame = async () => {
    const finalGameName = gameName.trim() || 'My Monopoly Game';
    
    try {
      setIsCreating(true);
      setError('');
      soundService.playGameStart();
      
      const data = await gameService.createGame({
        name: finalGameName,
        maxPlayers,
        startingBalance,
      });
      
      setShowHostModal(false);
      setGameName('');
      navigate(`/lobby/${data.game.code}`, { state: { game: data.game } });
    } catch (err) {
      setError(err.message);
      soundService.playClick();
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGame = async () => {
    if (gameCode.length !== 6) {
      setError('Please enter a valid 6-character code');
      return;
    }
    
    try {
      setIsJoining(true);
      setError('');
      soundService.playSuccess();
      
      const data = await gameService.joinGame(gameCode);
      
      setShowJoinModal(false);
      setGameCode('');
      
      // Navigate to lobby or game depending on status
      if (data.game.status === 'waiting') {
        navigate(`/lobby/${data.game.code}`, { state: { game: data.game } });
      } else {
        navigate(`/game/${data.game.code}`, { state: { game: data.game } });
      }
    } catch (err) {
      setError(err.message);
      soundService.playClick();
    } finally {
      setIsJoining(false);
    }
  };

  // Check for active game on load
  useEffect(() => {
    const checkActiveGame = async () => {
      try {
        const data = await gameService.getActiveGame();
        if (data.game) {
          // User has an active game, offer to rejoin
          if (data.game.status === 'waiting') {
            navigate(`/lobby/${data.game.code}`, { state: { game: data.game } });
          } else if (data.game.status === 'in_progress') {
            navigate(`/game/${data.game.code}`, { state: { game: data.game } });
          }
        }
      } catch (err) {
        console.error('Failed to check active game:', err);
      }
    };
    
    if (user) {
      checkActiveGame();
    }
  }, [user, navigate]);

  return (
    <div className="dashboard">
      {/* Background Blobs */}
      <div className="bg-blob bg-blob--pink"></div>
      <div className="bg-blob bg-blob--beige"></div>
      <div className="bg-blob bg-blob--purple"></div>

      {/* Floating Profile Button */}
      <div className="profile-wrapper" ref={profileMenuRef}>
        <button 
          className="profile-btn" 
          onClick={() => { soundService.playClick(); setShowProfileMenu(!showProfileMenu); }}
        >
          {userAvatar ? (
            <img src={userAvatar} alt="Profile" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-fallback">{getInitials(user.displayName || user.username)}</div>
          )}
        </button>
        
        {showProfileMenu && (
          <div className="profile-menu">
            <div className="profile-menu-header">
              {userAvatar ? (
                <img src={userAvatar} alt="" className="menu-avatar" />
              ) : (
                <div className="menu-avatar-fallback">{getInitials(user.displayName || user.username)}</div>
              )}
              <div className="menu-user-info">
                <span className="menu-display-name">{user.displayName || user.username}</span>
                <span className="menu-uid">UID: {user.uid}</span>
              </div>
            </div>
            <div className="menu-divider"></div>
            <button 
              className="menu-item" 
              onClick={() => { soundService.playNavigate(); navigate('/friends'); setShowProfileMenu(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Friends
              {pendingRequests > 0 && <span className="menu-badge">{pendingRequests}</span>}
            </button>
            <button 
              className="menu-item" 
              onClick={() => { soundService.playNavigate(); navigate('/settings'); setShowProfileMenu(false); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
            <div className="menu-divider"></div>
            <button className="menu-item logout" onClick={handleLogout}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="dashboard-content">
        {/* Brand Section */}
        <div className="brand-section">
          <img src={mrMonopolyImg} alt="Mr. Monopoly" className="brand-logo" draggable="false" />
          <span className="brand-title">Mono<span>Pay</span></span>
        </div>

        {/* Welcome Section */}
        <div className="welcome-section">
          <h1>Welcome back, <span>{user.displayName || user.username}</span>!</h1>
          <p>Ready to dominate the board?</p>
        </div>

        {/* Game Actions */}
        <div className="game-actions">
          <button className="action-card host" onClick={() => { soundService.playClick(); setShowHostModal(true); }}>
            <div className="action-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </div>
            <div className="action-text">
              <span className="action-title">Host a Game</span>
              <span className="action-desc">Create a new game room</span>
            </div>
          </button>

          <button className="action-card join" onClick={() => { soundService.playClick(); setShowJoinModal(true); }}>
            <div className="action-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="action-text">
              <span className="action-title">Join a Game</span>
              <span className="action-desc">Enter game code to join</span>
            </div>
          </button>
        </div>

        {/* Stats Section */}
        <div className="stats-section">
          <h2>Your Statistics</h2>
          {isLoading ? (
            <div className="loading-text">Loading stats...</div>
          ) : (
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{stats?.gamesPlayed || 0}</span>
                <span className="stat-label">Games Played</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{stats?.gamesWon || 0}</span>
                <span className="stat-label">Games Won</span>
              </div>
              <div className="stat-card highlight">
                <span className="stat-value">{stats?.winRate || '0%'}</span>
                <span className="stat-label">Win Rate</span>
              </div>
            </div>
          )}
        </div>

        {/* Friends Card */}
        <div className="friends-card">
          <div className="friends-card-header">
            <h2>Friends</h2>
            {pendingRequests > 0 && (
              <span className="pending-badge">{pendingRequests} new</span>
            )}
          </div>
          {friends.length > 0 ? (
            <div className="friends-list-mini">
              {friends.slice(0, 5).map((friend, index) => {
                const friendAvatar = (friend.avatar && friend.avatar.trim()) || (friend.picture && friend.picture.trim()) || null;
                return (
                <div key={friend._id || index} className="friend-item-mini">
                  <div className="friend-avatar-mini">
                    {friendAvatar ? (
                      <img src={friendAvatar} alt="" />
                    ) : (
                      <span>{getInitials(friend.displayName || friend.username)}</span>
                    )}
                    <div className={`online-indicator ${friend.isOnline ? 'online' : friend.inGame ? 'in-game' : 'offline'}`}></div>
                  </div>
                  <span className="friend-name-mini">{friend.displayName || friend.username}</span>
                  {friend.inGame && <span className="in-game-badge">In Game</span>}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-friends">
              <p>No friends yet</p>
              <span>Add friends to play together!</span>
            </div>
          )}
          <button 
            className="see-more-btn" 
            onClick={() => { soundService.playNavigate(); navigate('/friends'); }}
          >
            {friends.length > 0 ? 'See all friends' : 'Add friends'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        </div>

        {/* Recent Games */}
        <div className="recent-section">
          <h2>Recent Games</h2>
          {gameHistory.length > 0 ? (
            <div className="games-list">
              {gameHistory.slice(0, 5).map((game, index) => (
                <div key={index} className="game-row">
                  <div className="game-date">{new Date(game.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  <div className="game-info">
                    <span className="game-players">{game.players} players</span>
                    <span className={`game-result ${game.won ? 'won' : 'lost'}`}>
                      {game.won ? '🏆 Victory' : 'Defeat'}
                    </span>
                  </div>
                  <span className={`game-earnings ${game.earnings >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(game.earnings)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No games played yet</p>
              <span>Start a game to see your history!</span>
            </div>
          )}
        </div>
      </main>

      {/* Host Game Modal */}
      {showHostModal && (
        <div className="modal-overlay" onClick={() => { soundService.playModalClose(); setShowHostModal(false); setError(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Host a Game</h2>
              <button className="modal-close" onClick={() => { soundService.playModalClose(); setShowHostModal(false); setError(''); }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Game Name</label>
                <input
                  type="text"
                  className="game-name-input"
                  placeholder="My Monopoly Game"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  maxLength={30}
                />
              </div>
              <div className="form-group">
                <label>Select Edition</label>
                <div className="edition-grid">
                  {monopolyEditions.map((edition) => (
                    <button
                      key={edition.id}
                      className={`edition-btn ${selectedEdition === edition.id ? 'selected' : ''} ${!edition.available ? 'disabled' : ''}`}
                      onClick={() => { if (edition.available) { soundService.playClick(); setSelectedEdition(edition.id); } }}
                      disabled={!edition.available}
                    >
                      <span className="edition-name">{edition.name}</span>
                      {!edition.available && <span className="coming-soon">Coming Soon</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Room Settings</label>
                <div className="setting-row">
                  <span>Max Players</span>
                  <select value={maxPlayers} onChange={(e) => { soundService.playClick(); setMaxPlayers(parseInt(e.target.value)); }}>
                    <option value="2">2 Players</option>
                    <option value="3">3 Players</option>
                    <option value="4">4 Players</option>
                    <option value="5">5 Players</option>
                    <option value="6">6 Players</option>
                    <option value="7">7 Players</option>
                    <option value="8">8 Players</option>
                  </select>
                </div>
                <div className="setting-row">
                  <span>Starting Money</span>
                  <select value={startingBalance} onChange={(e) => { soundService.playClick(); setStartingBalance(parseInt(e.target.value)); }}>
                    <option value="1000">$1,000</option>
                    <option value="1500">$1,500</option>
                    <option value="2000">$2,000</option>
                    <option value="2500">$2,500</option>
                  </select>
                </div>
              </div>
              {error && <div className="modal-error">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { soundService.playClick(); setShowHostModal(false); setError(''); }}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateGame} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Game Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => { soundService.playModalClose(); setShowJoinModal(false); setError(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Join a Game</h2>
              <button className="modal-close" onClick={() => { soundService.playModalClose(); setShowJoinModal(false); setError(''); }}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Enter Game Code</label>
                <input
                  type="text"
                  className="game-code-input"
                  placeholder="XXXXXX"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  maxLength={6}
                />
                <p className="input-hint">Ask the host for the 6-character code</p>
              </div>
              {error && <div className="modal-error">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { soundService.playClick(); setShowJoinModal(false); setError(''); }}>Cancel</button>
              <button className="btn-primary" disabled={gameCode.length !== 6 || isJoining} onClick={handleJoinGame}>
                {isJoining ? 'Joining...' : 'Join Game'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
