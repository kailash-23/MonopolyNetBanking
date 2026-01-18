import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import { soundService } from '../services/soundService';
import './Settings.css';

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

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const handleProfileChange = (key, value) => {
    setProfileData(prev => ({ ...prev, [key]: value }));
  };

  const handleGameSettingsChange = (key, value) => {
    setGameSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    if (!profileData.username.trim() || !profileData.displayName.trim()) {
      showMessage('error', 'Username and Display Name are required');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.updateProfile({
        username: profileData.username,
        displayName: profileData.displayName
      });
      if (response.success) {
        showMessage('success', 'Profile updated successfully!');
      } else {
        showMessage('error', response.message || 'Failed to update profile');
      }
    } catch (error) {
      showMessage('error', 'Failed to update profile');
    } finally {
      setLoading(false);
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

      {/* Floating Back Button */}
      <button className="floating-back-btn" onClick={() => navigate('/dashboard')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      {/* Content */}
      <main className="settings-content">
        <h1 className="page-title">Settings</h1>

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
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="preview-avatar" />
            ) : (
              <div className="preview-avatar-fallback">
                {(user.displayName || user.username || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="preview-info">
              <span className="preview-name">{user.displayName || user.username}</span>
              <span className="preview-uid">UID: {user.uid || 'Not assigned'}</span>
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
    </div>
  );
};

export default Settings;
