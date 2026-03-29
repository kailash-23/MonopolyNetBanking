import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { soundService } from '../services/soundService';
import './Friends.css';

/* ====== Debounce Hook ====== */
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ====== Avatar Component (memoized) ====== */
const Avatar = React.memo(({ name, src, size = 44 }) => {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  return (
    <div className="friend-avatar-wrapper" style={{ width: size, height: size }}>
      {src && (
        <img src={src} alt="" className="friend-avatar" 
          onError={(e) => { e.target.style.display = 'none'; }} />
      )}
      <div className="friend-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.36 }}>
        {initials}
      </div>
    </div>
  );
});

/* ====== Skeleton Cards ====== */
const SkeletonCard = () => (
  <div className="friend-card skeleton-card">
    <div className="friend-info">
      <div className="skeleton skeleton-avatar" />
      <div className="friend-details">
        <div className="skeleton skeleton-name" />
        <div className="skeleton skeleton-uid" />
      </div>
    </div>
    <div className="skeleton skeleton-btn" />
  </div>
);

const SkeletonList = ({ count = 3 }) => (
  <div className="skeleton-list">{Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}</div>
);

/* ====== Inline Confirm ====== */
const InlineConfirm = ({ message, onConfirm, onCancel }) => (
  <div className="inline-confirm">
    <span>{message}</span>
    <div className="inline-confirm-actions">
      <button className="confirm-yes" onClick={onConfirm}>Remove</button>
      <button className="confirm-no" onClick={onCancel}>Keep</button>
    </div>
  </div>
);

/* ====== Main Component ====== */
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
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [busyActions, setBusyActions] = useState(new Set());
  const searchInputRef = useRef(null);
  const messageTimerRef = useRef(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Refresh friends data (shared by mount, tab-switch, and visibility-change)
  const refreshFriends = useCallback(async (silent = false) => {
    try {
      const data = await authService.getFriends();
      setFriends(data.friends || []);
      setPendingReceived(data.pendingReceived || []);
      setPendingSent(data.pendingSent || []);
    } catch (error) {
      if (!silent) showMessage('error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refreshFriends(false);
  }, [refreshFriends]);

  // Cleanup messageTimerRef on unmount
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  // Re-sync when browser tab becomes visible again (catches external accepts/rejects)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshFriends(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshFriends]);

  // Debounced search effect
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const search = async () => {
      setIsSearching(true);
      try {
        const data = await authService.searchUsers(debouncedQuery);
        if (!cancelled) setSearchResults(data.users || []);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };
    search();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  }, []);

  // Helper to track busy state per action
  const markBusy = (id) => setBusyActions(prev => new Set(prev).add(id));
  const clearBusy = (id) => setBusyActions(prev => { const s = new Set(prev); s.delete(id); return s; });

  const handleSendRequest = async (userId) => {
    markBusy(`send-${userId}`);
    try {
      soundService.playClick();
      const data = await authService.sendFriendRequest(userId);
      soundService.playSuccess();
      showMessage('success', 'Friend request sent!');

      // Update search results optimistically
      setSearchResults(prev => prev.map(u => u._id === userId ? { ...u, status: 'pending_sent' } : u));
      // Use server-returned data if available
      if (data.pendingSent) setPendingSent(data.pendingSent);
    } catch (error) {
      soundService.playError?.();
      showMessage('error', error.message);
    } finally {
      clearBusy(`send-${userId}`);
    }
  };

  const handleAcceptRequest = async (requesterId) => {
    markBusy(`accept-${requesterId}`);
    // Optimistic: remove from received immediately
    setPendingReceived(prev => prev.filter(r => (r.from?._id || r.from) !== requesterId));
    try {
      soundService.playClick();
      const data = await authService.acceptFriendRequest(requesterId);
      soundService.playSuccess();
      soundService.playFriendRequest?.();
      showMessage('success', 'Friend request accepted!');

      // Use server-returned data
      if (data.friends) setFriends(data.friends);
      if (data.pendingReceived) setPendingReceived(data.pendingReceived);
      if (data.pendingSent) setPendingSent(data.pendingSent);
      // Update search results
      setSearchResults(prev => prev.map(u => u._id === requesterId ? { ...u, status: 'friend' } : u));
    } catch (error) {
      soundService.playError?.();
      showMessage('error', error.message);
      // Rollback: refetch on failure
      try { const data = await authService.getFriends(); setPendingReceived(data.pendingReceived || []); } catch {}
    } finally {
      clearBusy(`accept-${requesterId}`);
    }
  };

  const handleRejectRequest = async (requesterId) => {
    markBusy(`reject-${requesterId}`);
    setPendingReceived(prev => prev.filter(r => (r.from?._id || r.from) !== requesterId));
    try {
      soundService.playClick();
      const data = await authService.rejectFriendRequest(requesterId);
      showMessage('success', 'Friend request rejected');
      if (data.pendingReceived) setPendingReceived(data.pendingReceived);
    } catch (error) {
      soundService.playError?.();
      showMessage('error', error.message);
      try { const data = await authService.getFriends(); setPendingReceived(data.pendingReceived || []); } catch {}
    } finally {
      clearBusy(`reject-${requesterId}`);
    }
  };

  const handleCancelRequest = async (targetUserId) => {
    markBusy(`cancel-${targetUserId}`);
    setPendingSent(prev => prev.filter(r => (r.to?._id || r.to) !== targetUserId));
    try {
      soundService.playClick();
      const data = await authService.cancelFriendRequest(targetUserId);
      showMessage('success', 'Friend request cancelled');
      if (data.pendingSent) setPendingSent(data.pendingSent);
      setSearchResults(prev => prev.map(u => u._id === targetUserId ? { ...u, status: 'none' } : u));
    } catch (error) {
      soundService.playError?.();
      showMessage('error', error.message);
      try { const data = await authService.getFriends(); setPendingSent(data.pendingSent || []); } catch {}
    } finally {
      clearBusy(`cancel-${targetUserId}`);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    markBusy(`remove-${friendId}`);
    setConfirmRemove(null);
    const removedFriend = friends.find(f => f._id === friendId);
    setFriends(prev => prev.filter(f => f._id !== friendId));
    try {
      soundService.playClick();
      const data = await authService.removeFriend(friendId);
      showMessage('success', 'Friend removed');
      if (data.friends) setFriends(data.friends);
    } catch (error) {
      soundService.playError?.();
      showMessage('error', error.message);
      if (removedFriend) setFriends(prev => [...prev, removedFriend]);
    } finally {
      clearBusy(`remove-${friendId}`);
    }
  };

  const handleTabChange = (tab) => {
    soundService.playClick();
    setActiveTab(tab);
    if (tab === 'add') {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    // Silently refresh when switching to requests or friends tab
    // so accepted/rejected requests from others are reflected immediately
    if (tab === 'requests' || tab === 'friends') {
      refreshFriends(true);
    }
  };

  const requestCount = pendingReceived.length + pendingSent.length;

  return (
    <div className="friends-page">
      <div className="bg-blob bg-blob--pink" />
      <div className="bg-blob bg-blob--beige" />
      <div className="bg-blob bg-blob--purple" />

      <main className="friends-content">
        {/* Header */}
        <div className="page-header">
          <button className="back-btn" onClick={() => { soundService.playNavigate?.(); navigate('/dashboard'); }}>
            ←
          </button>
          <h1 className="page-title">Friends</h1>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`message-banner ${message.type}`}>
            {message.type === 'success' && <span className="msg-icon">✓</span>}
            {message.type === 'error' && <span className="msg-icon">!</span>}
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div className="friends-tabs">
          <button className={`tab-btn ${activeTab === 'friends' ? 'active' : ''}`}
            onClick={() => handleTabChange('friends')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Friends ({friends.length})
          </button>
          <button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => handleTabChange('requests')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Requests
            {requestCount > 0 && <span className="badge">{requestCount}</span>}
          </button>
          <button className={`tab-btn ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => handleTabChange('add')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Add Friend
          </button>
        </div>

        {/* ====== Friends Tab ====== */}
        {activeTab === 'friends' && (
          <div className="friends-list">
            {loading ? <SkeletonList count={3} /> : friends.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No friends yet</h3>
                <p>Search for players to add them as friends!</p>
                <button className="add-btn" onClick={() => handleTabChange('add')}>Add Friends</button>
              </div>
            ) : (
              friends.map(friend => (
                <div key={friend._id} className="friend-card">
                  {confirmRemove === friend._id ? (
                    <InlineConfirm
                      message={`Remove ${friend.displayName || friend.username}?`}
                      onConfirm={() => handleRemoveFriend(friend._id)}
                      onCancel={() => setConfirmRemove(null)}
                    />
                  ) : (
                    <>
                      <div className="friend-info">
                        <Avatar name={friend.displayName || friend.username} src={friend.avatar} />
                        <div className="friend-details">
                          <span className="friend-name">{friend.displayName || friend.username}</span>
                          <span className="friend-uid">UID: {friend.uid}</span>
                          <span className="friend-stats">
                            {friend.stats?.gamesPlayed || 0} games · {friend.stats?.gamesWon || 0} wins
                          </span>
                        </div>
                      </div>
                      <div className="friend-actions">
                        <button className="action-btn invite" title="Invite to game">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                          </svg>
                        </button>
                        <button className="action-btn remove" title="Remove friend"
                          disabled={busyActions.has(`remove-${friend._id}`)}
                          onClick={() => setConfirmRemove(friend._id)}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
                            <line x1="18" y1="11" x2="23" y2="11"/>
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ====== Requests Tab ====== */}
        {activeTab === 'requests' && (
          <div className="requests-section">
            {loading ? <SkeletonList count={2} /> : (
              <>
                {/* Received */}
                <div className="requests-group">
                  <h3 className="requests-group-title">
                    Received
                    {pendingReceived.length > 0 && <span className="count-pill">{pendingReceived.length}</span>}
                  </h3>
                  {pendingReceived.length === 0 ? (
                    <p className="no-requests">No pending requests</p>
                  ) : (
                    pendingReceived.map(request => {
                      const from = request.from;
                      const id = from?._id || from;
                      return (
                        <div key={id} className="request-card">
                          <div className="friend-info">
                            <Avatar name={from?.displayName || from?.username} src={from?.avatar} />
                            <div className="friend-details">
                              <span className="friend-name">{from?.displayName || from?.username}</span>
                              <span className="friend-uid">UID: {from?.uid}</span>
                            </div>
                          </div>
                          <div className="request-actions">
                            <button className="accept-btn" 
                              disabled={busyActions.has(`accept-${id}`)}
                              onClick={() => handleAcceptRequest(id)}>
                              {busyActions.has(`accept-${id}`) ? '...' : 'Accept'}
                            </button>
                            <button className="reject-btn"
                              disabled={busyActions.has(`reject-${id}`)}
                              onClick={() => handleRejectRequest(id)}>
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sent */}
                <div className="requests-group">
                  <h3 className="requests-group-title">
                    Sent
                    {pendingSent.length > 0 && <span className="count-pill">{pendingSent.length}</span>}
                  </h3>
                  {pendingSent.length === 0 ? (
                    <p className="no-requests">No sent requests</p>
                  ) : (
                    pendingSent.map(request => {
                      const to = request.to;
                      const id = to?._id || to;
                      return (
                        <div key={id} className="request-card">
                          <div className="friend-info">
                            <Avatar name={to?.displayName || to?.username} src={to?.avatar} />
                            <div className="friend-details">
                              <span className="friend-name">{to?.displayName || to?.username}</span>
                              <span className="friend-uid">UID: {to?.uid}</span>
                            </div>
                          </div>
                          <button className="cancel-btn"
                            disabled={busyActions.has(`cancel-${id}`)}
                            onClick={() => handleCancelRequest(id)}>
                            {busyActions.has(`cancel-${id}`) ? '...' : 'Cancel'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ====== Add Friend Tab ====== */}
        {activeTab === 'add' && (
          <div className="add-friend-section">
            <div className="search-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by username or UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
                autoFocus
              />
              {searchQuery && (
                <button className="clear-btn" onClick={() => { setSearchQuery(''); setSearchResults([]); searchInputRef.current?.focus(); }}>×</button>
              )}
            </div>

            {/* Search states */}
            {isSearching && searchQuery.length >= 2 && <SkeletonList count={2} />}

            {!isSearching && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(user => {
                  const actionKey = user.status === 'pending_sent' ? `cancel-${user._id}`
                    : user.status === 'pending_received' ? `accept-${user._id}`
                    : `send-${user._id}`;
                  const isBusy = busyActions.has(actionKey);

                  return (
                    <div key={user._id} className="search-result-card">
                      <div className="friend-info">
                        <Avatar name={user.displayName || user.username} src={user.avatar} />
                        <div className="friend-details">
                          <span className="friend-name">{user.displayName || user.username}</span>
                          <span className="friend-uid">UID: {user.uid}</span>
                        </div>
                      </div>
                      {user.status === 'friend' ? (
                        <span className="status-badge friend">✓ Friends</span>
                      ) : user.status === 'pending_sent' ? (
                        <button className="cancel-btn" disabled={isBusy}
                          onClick={() => handleCancelRequest(user._id)}>
                          {isBusy ? '...' : 'Cancel'}
                        </button>
                      ) : user.status === 'pending_received' ? (
                        <button className="accept-btn" disabled={isBusy}
                          onClick={() => handleAcceptRequest(user._id)}>
                          {isBusy ? '...' : 'Accept'}
                        </button>
                      ) : (
                        <button className="send-btn" disabled={isBusy}
                          onClick={() => handleSendRequest(user._id)}>
                          {isBusy ? '...' : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
                                <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
                              </svg>
                              Add
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="no-results">
                <p>No users found matching "{searchQuery}"</p>
              </div>
            )}

            {searchQuery.length < 2 && !isSearching && (
              <div className="search-hint">
                <div className="hint-icon">🔍</div>
                <p>Enter a username or UID to find players</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Friends;
