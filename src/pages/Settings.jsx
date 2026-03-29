import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import { soundService } from '../services/soundService';
import './Settings.css';

// Avatar collection - limited preset avatars
const AVATAR_COLLECTION = [
  { id: 'avatar1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4' },
  { id: 'avatar2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=c0aede' },
  { id: 'avatar3', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Pepper&backgroundColor=ffd5dc' },
  { id: 'avatar4', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo&backgroundColor=d1f4d1' },
  { id: 'avatar5', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=ffdfba' },
  { id: 'avatar6', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rocky&backgroundColor=bae1ff' },
  { id: 'avatar7', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Monopoly&backgroundColor=c0aede' },
  { id: 'avatar8', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Banker&backgroundColor=b6e3f4' },
  { id: 'avatar9', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Money&backgroundColor=ffd5dc' },
  { id: 'avatar10', url: 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=Rich&backgroundColor=d1f4d1' },
  { id: 'avatar11', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Player1&backgroundColor=ffdfba' },
  { id: 'avatar12', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Player2&backgroundColor=bae1ff' },
];

const Settings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile Settings State
  const [profileData, setProfileData] = useState({
    username: '',
    displayName: ''
  });

  // Game Settings State
  const [gameSettings, setGameSettings] = useState({
    soundEnabled: true,
    notificationsEnabled: true,
    language: 'en'
  });

  // Avatar picker state
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const messageTimerRef = useRef(null);

  // Cleanup message timer on unmount
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate('/signin');
      return;
    }
    setUser(currentUser);
    
    // Load profile
    setProfileData({
      username: currentUser.username || '',
      displayName: currentUser.displayName || currentUser.name || ''
    });

    // Load settings
    if (currentUser.settings) {
      setGameSettings({
        soundEnabled: currentUser.settings.soundEnabled ?? true,
        notificationsEnabled: currentUser.settings.notificationsEnabled ?? true,
        language: currentUser.settings.language || 'en'
      });
    }
  }, [navigate]);

  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  }, []);

  const handleProfileChange = (key, value) => {
    setProfileData(prev => ({ ...prev, [key]: value }));
  };

  const handleGameSettingsChange = (key, value) => {
    setGameSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    // Validate username
    if (!profileData.username.trim()) {
      showMessage('error', 'Username is required');
      return;
    }
    
    if (profileData.username.trim().length < 3) {
      showMessage('error', 'Username must be at least 3 characters');
      return;
    }
    
    if (profileData.username.trim().length > 20) {
      showMessage('error', 'Username cannot exceed 20 characters');
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(profileData.username.trim())) {
      showMessage('error', 'Username can only contain letters, numbers, and underscores');
      return;
    }

    if (!profileData.displayName.trim()) {
      showMessage('error', 'Display Name is required');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.updateProfile({
        username: profileData.username.trim().toLowerCase(),
        displayName: profileData.displayName.trim()
      });
      if (response.success) {
        soundService.playSuccess();
        showMessage('success', 'Profile updated successfully!');
      } else {
        soundService.playError();
        showMessage('error', response.message || 'Failed to update profile');
      }
    } catch (error) {
      soundService.playError();
      showMessage('error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAvatar = async (avatarUrl) => {
    setSavingAvatar(true);
    soundService.playClick();
    try {
      const response = await authService.updateProfile({ avatar: avatarUrl });
      if (response.success) {
        setUser(response.user);
        soundService.playSuccess();
        showMessage('success', 'Avatar updated!');
        setShowAvatarPicker(false);
      }
    } catch (error) {
      soundService.playError();
      showMessage('error', error.message || 'Failed to update avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setSavingAvatar(true);
    soundService.playClick();
    try {
      // Set avatar to empty string - backend/frontend will fallback to Google picture
      const response = await authService.updateProfile({ avatar: '' });
      if (response.success) {
        setUser(response.user);
        soundService.playSuccess();
        showMessage('success', 'Avatar removed - using Google profile picture');
        setShowAvatarPicker(false);
      }
    } catch (error) {
      soundService.playError();
      showMessage('error', error.message || 'Failed to remove avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveGameSettings = async () => {
    setLoading(true);
    try {
      const response = await authService.updateSettings(gameSettings);
      if (response.success) {
        // Update sound service with new settings
        soundService.updateSettings(gameSettings.soundEnabled, gameSettings.notificationsEnabled);
        soundService.playSuccess();
        showMessage('success', 'Settings saved successfully!');
      } else {
        soundService.playError();
        showMessage('error', response.message || 'Failed to save settings');
      }
    } catch (error) {
      soundService.playError();
      showMessage('error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key, value) => {
    soundService.playToggle(value);
    handleGameSettingsChange(key, value);
  };

  const sendPasswordResetEmail = async () => {
    if (!user?.email) {
      showMessage('error', 'No email associated with this account');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.sendPasswordReset(user.email);
      if (response.success) {
        showMessage('success', 'Password reset email sent! Check your inbox.');
      } else {
        showMessage('error', response.message || 'Failed to send reset email');
      }
    } catch (error) {
      showMessage('error', 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authService.signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="settings-page">
        <div className="bg-blob bg-blob--pink"></div>
        <div className="bg-blob bg-blob--beige"></div>
        <div className="bg-blob bg-blob--purple"></div>
        <div className="settings-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Background Blobs */}
      <div className="bg-blob bg-blob--pink"></div>
      <div className="bg-blob bg-blob--beige"></div>
      <div className="bg-blob bg-blob--purple"></div>

      {/* Content */}
      <main className="settings-content">
        {/* Header with Back Button */}
        <div className="page-header">
          <button className="back-btn" onClick={() => { soundService.playNavigate(); navigate('/dashboard'); }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="page-title">Settings</h1>
        </div>

        {/* Message Banner */}
        {message.text && (
          <div className={`message-banner ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Profile Section */}
        <section className="settings-card">
          <h2>Profile</h2>
          
          <div className="profile-preview">
            <div className="avatar-edit-container" onClick={() => { soundService.playClick(); setShowAvatarPicker(true); }}>
              {(user.avatar && user.avatar.trim()) || (user.picture && user.picture.trim()) ? (
                <img src={user.avatar || user.picture} alt="Avatar" className="preview-avatar" />
              ) : (
                <div className="preview-avatar-fallback">
                  {(user.displayName || user.username || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="avatar-edit-overlay">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
            </div>
            <div className="preview-info">
              <span className="preview-name">{user.displayName || user.username}</span>
              <span className="preview-uid">UID: {user.uid || 'Not assigned'}</span>
              <button className="change-avatar-btn" onClick={() => { soundService.playClick(); setShowAvatarPicker(true); }}>
                Change Avatar
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Username</label>
            <input 
              type="text"
              value={profileData.username}
              onChange={(e) => handleProfileChange('username', e.target.value)}
              placeholder="Enter username"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <input 
              type="text"
              value={profileData.displayName}
              onChange={(e) => handleProfileChange('displayName', e.target.value)}
              placeholder="Enter display name"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input 
              type="email"
              value={user.email || ''}
              disabled
              className="form-input disabled"
            />
            <span className="form-hint">Email cannot be changed</span>
          </div>

          <button 
            className="save-btn" 
            onClick={saveProfile}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </section>

        {/* Game Settings Section */}
        <section className="settings-card">
          <h2>Game Settings</h2>

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">Sound Effects</span>
              <span className="setting-desc">Play sounds during gameplay</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={gameSettings.soundEnabled}
                onChange={(e) => handleToggle('soundEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">Notifications</span>
              <span className="setting-desc">Receive game notifications</span>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={gameSettings.notificationsEnabled}
                onChange={(e) => handleToggle('notificationsEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <span className="setting-label">Language</span>
              <span className="setting-desc">Select your preferred language</span>
            </div>
            <select 
              value={gameSettings.language}
              onChange={(e) => { soundService.playClick(); handleGameSettingsChange('language', e.target.value); }}
              className="setting-select"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="hi">हिंदी</option>
            </select>
          </div>

          <button 
            className="save-btn" 
            onClick={saveGameSettings}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </section>

        {/* Password Section */}
        <section className="settings-card">
          <h2>Password</h2>
          <p className="section-desc">
            {user.googleId 
              ? "You signed in with Google. You can set a password for email login."
              : "Reset your account password via email."
            }
          </p>
          
          <button 
            className="reset-btn" 
            onClick={sendPasswordResetEmail}
            disabled={loading || !user.email}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            {loading ? 'Sending...' : 'Send Password Reset Email'}
          </button>
          {user.email && (
            <span className="form-hint">A reset link will be sent to {user.email}</span>
          )}
        </section>

        {/* Terms & Sign Out */}
        <section className="settings-card">
          <button onClick={() => { soundService.playNavigate(); navigate('/terms'); }} className="link-item">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            Terms & Conditions
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          
          <button className="logout-btn" onClick={handleLogout}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign Out
          </button>
        </section>
      </main>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="modal-overlay" onClick={() => setShowAvatarPicker(false)}>
          <div className="avatar-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Choose Avatar</h2>
              <button className="modal-close" onClick={() => setShowAvatarPicker(false)}>×</button>
            </div>
            <div className="avatar-grid">
              {AVATAR_COLLECTION.map((avatar) => (
                <button
                  key={avatar.id}
                  className={`avatar-option ${user.avatar === avatar.url ? 'selected' : ''}`}
                  onClick={() => handleSelectAvatar(avatar.url)}
                  disabled={savingAvatar}
                >
                  <img src={avatar.url} alt={avatar.id} />
                </button>
              ))}
            </div>
            {user.picture && (
              <button 
                className="remove-avatar-btn"
                onClick={handleRemoveAvatar}
                disabled={savingAvatar}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                {savingAvatar ? 'Removing...' : 'Use Google Profile Picture'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
