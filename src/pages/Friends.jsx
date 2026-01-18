import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { soundService } from '../services/soundService';
import './Friends.css';

const Friends = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [pendingSent, setPendingSent] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const data = await authService.getFriends();
      setFriends(data.friends || []);
      setPendingReceived(data.pendingReceived || []);
      setPendingSent(data.pendingSent || []);
    } catch (error) {
      console.error('Failed to load friends:', error);
      showMessage('error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const data = await authService.searchUsers(query);
      setSearchResults(data.users || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (userId) => {
    try {
      soundService.playClick();
      await authService.sendFriendRequest(userId);
      soundService.playSuccess();
      showMessage('success', 'Friend request sent!');
      
      // Update search results
      setSearchResults(prev => 
        prev.map(u => u._id === userId ? { ...u, status: 'pending_sent' } : u)
      );
      loadFriends();
    } catch (error) {
      soundService.playError();
      showMessage('error', error.message);
    }
  };

  const handleAcceptRequest = async (requesterId) => {
    try {
      soundService.playClick();
      await authService.acceptFriendRequest(requesterId);
      soundService.playSuccess();
      soundService.playFriendRequest();
      showMessage('success', 'Friend request accepted!');
      loadFriends();
    } catch (error) {
      soundService.playError();
      showMessage('error', error.message);
    }
  };

  const handleRejectRequest = async (requesterId) => {
    try {
      soundService.playClick();
      await authService.rejectFriendRequest(requesterId);
      showMessage('success', 'Friend request rejected');
      loadFriends();
    } catch (error) {
      soundService.playError();
      showMessage('error', error.message);
    }
  };

  const handleCancelRequest = async (targetUserId) => {
    try {
      soundService.playClick();
      await authService.cancelFriendRequest(targetUserId);
      showMessage('success', 'Friend request cancelled');
      loadFriends();
      // Update search results too
      setSearchResults(prev => 
        prev.map(u => u._id === targetUserId ? { ...u, status: 'none' } : u)
      );
    } catch (error) {
      soundService.playError();
      showMessage('error', error.message);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) return;
    
    try {
      soundService.playClick();
      await authService.removeFriend(friendId);
      showMessage('success', 'Friend removed');
      loadFriends();
    } catch (error) {
      soundService.playError();
      showMessage('error', error.message);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleTabChange = (tab) => {
    soundService.playClick();
    setActiveTab(tab);
  };

  return (
    <div className="friends-page">
      {/* Background Blobs */}
      <div className="bg-blob bg-blob--pink"></div>
      <div className="bg-blob bg-blob--beige"></div>
      <div className="bg-blob bg-blob--purple"></div>

      {/* Content */}
      <main className="friends-content">
        {/* Header with Back Button */}
        <div className="page-header">
          <button className="back-btn" onClick={() => { soundService.playNavigate(); navigate('/dashboard'); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="page-title">Friends</h1>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`message-banner ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="friends-tabs">
          <button 
            className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => handleTabChange('friends')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Friends ({friends.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => handleTabChange('requests')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Requests
            {pendingReceived.length > 0 && (
              <span className="badge">{pendingReceived.length}</span>
            )}
          </button>
          <button 
            className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => handleTabChange('add')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Add Friend
          </button>
        </div>

        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : (
          <>
            {/* Friends List Tab */}
            {activeTab === 'friends' && (
              <div className="friends-list">
                {friends.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">👥</div>
                    <h3>No friends yet</h3>
                    <p>Search for players to add them as friends!</p>
                    <button className="add-btn" onClick={() => handleTabChange('add')}>
                      Add Friends
                    </button>
                  </div>
                ) : (
                  friends.map(friend => (
                    <div key={friend._id} className="friend-card">
                      <div className="friend-info">
                        {friend.avatar ? (
                          <img src={friend.avatar} alt="" className="friend-avatar" />
                        ) : (
                          <div className="friend-avatar-fallback">
                            {getInitials(friend.displayName || friend.username)}
                          </div>
                        )}
                        <div className="friend-details">
                          <span className="friend-name">{friend.displayName || friend.username}</span>
                          <span className="friend-uid">UID: {friend.uid}</span>
                          <span className="friend-stats">
                            {friend.stats?.gamesPlayed || 0} games • {friend.stats?.gamesWon || 0} wins
                          </span>
                        </div>
                      </div>
                      <div className="friend-actions">
                        <button className="action-btn invite" title="Invite to game">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                          </svg>
                        </button>
                        <button 
                          className="action-btn remove" 
                          title="Remove friend"
                          onClick={() => handleRemoveFriend(friend._id)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="8.5" cy="7" r="4"/>
                            <line x1="18" y1="11" x2="23" y2="11"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="requests-section">
                {/* Received Requests */}
                <div className="requests-group">
                  <h3>Received ({pendingReceived.length})</h3>
                  {pendingReceived.length === 0 ? (
                    <p className="no-requests">No pending requests</p>
                  ) : (
                    pendingReceived.map(request => (
                      <div key={request.from._id} className="request-card">
                        <div className="friend-info">
                          {request.from.avatar ? (
                            <img src={request.from.avatar} alt="" className="friend-avatar" />
                          ) : (
                            <div className="friend-avatar-fallback">
                              {getInitials(request.from.displayName || request.from.username)}
                            </div>
                          )}
                          <div className="friend-details">
                            <span className="friend-name">{request.from.displayName || request.from.username}</span>
                            <span className="friend-uid">UID: {request.from.uid}</span>
                          </div>
                        </div>
                        <div className="request-actions">
                          <button 
                            className="accept-btn"
                            onClick={() => handleAcceptRequest(request.from._id)}
                          >
                            Accept
                          </button>
                          <button 
                            className="reject-btn"
                            onClick={() => handleRejectRequest(request.from._id)}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Sent Requests */}
                <div className="requests-group">
                  <h3>Sent ({pendingSent.length})</h3>
                  {pendingSent.length === 0 ? (
                    <p className="no-requests">No sent requests</p>
                  ) : (
                    pendingSent.map(request => (
                      <div key={request.to._id} className="request-card">
                        <div className="friend-info">
                          {request.to.avatar ? (
                            <img src={request.to.avatar} alt="" className="friend-avatar" />
                          ) : (
                            <div className="friend-avatar-fallback">
                              {getInitials(request.to.displayName || request.to.username)}
                            </div>
                          )}
                          <div className="friend-details">
                            <span className="friend-name">{request.to.displayName || request.to.username}</span>
                            <span className="friend-uid">UID: {request.to.uid}</span>
                          </div>
                        </div>
                        <button 
                          className="cancel-btn"
                          onClick={() => handleCancelRequest(request.to._id)}
                        >
                          Cancel
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Add Friend Tab */}
            {activeTab === 'add' && (
              <div className="add-friend-section">
                <div className="search-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by username or UID..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="search-input"
                  />
                  {searchQuery && (
                    <button className="clear-btn" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                      ×
                    </button>
                  )}
                </div>

                {isSearching && <div className="searching">Searching...</div>}

                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map(user => (
                      <div key={user._id} className="search-result-card">
                        <div className="friend-info">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="friend-avatar" />
                          ) : (
                            <div className="friend-avatar-fallback">
                              {getInitials(user.displayName || user.username)}
                            </div>
                          )}
                          <div className="friend-details">
                            <span className="friend-name">{user.displayName || user.username}</span>
                            <span className="friend-uid">UID: {user.uid}</span>
                          </div>
                        </div>
                        {user.status === 'friend' ? (
                          <span className="status-badge friend">✓ Friends</span>
                        ) : user.status === 'pending_sent' ? (
                          <button 
                            className="cancel-btn"
                            onClick={() => handleCancelRequest(user._id)}
                          >
                            Cancel
                          </button>
                        ) : user.status === 'pending_received' ? (
                          <button 
                            className="accept-btn"
                            onClick={() => handleAcceptRequest(user._id)}
                          >
                            Accept
                          </button>
                        ) : (
                          <button 
                            className="send-btn"
                            onClick={() => handleSendRequest(user._id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                              <circle cx="8.5" cy="7" r="4"/>
                              <line x1="20" y1="8" x2="20" y2="14"/>
                              <line x1="23" y1="11" x2="17" y2="11"/>
                            </svg>
                            Add
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                  <div className="no-results">
                    <p>No users found matching "{searchQuery}"</p>
                  </div>
                )}

                {searchQuery.length < 2 && (
                  <div className="search-hint">
                    <div className="hint-icon">🔍</div>
                    <p>Enter a username or UID to find players</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Friends;
