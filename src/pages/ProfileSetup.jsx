import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import mrMonopolyImg from '../mrMonopoly.png';
import './ProfileSetup.css';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

function ProfileSetup() {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [usernameStatus, setUsernameStatus] = useState({ available: null, message: '' });
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const debouncedUsername = useDebounce(username, 500);

  // Check username availability
  useEffect(() => {
    if (debouncedUsername.length >= 3) {
      setIsChecking(true);
      authService.checkUsername(debouncedUsername)
        .then(result => {
          setUsernameStatus(result);
          setIsChecking(false);
        })
        .catch(() => {
          setUsernameStatus({ available: null, message: '' });
          setIsChecking(false);
        });
    } else if (debouncedUsername.length > 0) {
      setUsernameStatus({ available: false, message: 'Username must be at least 3 characters' });
    } else {
      setUsernameStatus({ available: null, message: '' });
    }
  }, [debouncedUsername]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!usernameStatus.available) {
      setError('Please choose an available username');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await authService.completeProfile({
        username: username.trim(),
        displayName: displayName.trim() || undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to set up profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if no user or profile is already complete
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.isProfileComplete !== false) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="profile-setup">
      <div className="profile-setup-container">
        <div className="setup-header">
          <img src={mrMonopolyImg} alt="Mr. Monopoly" className="setup-mascot" />
          <h1>Complete Your Profile</h1>
          <p>Choose a unique username to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          {/* User Avatar */}
          <div className="avatar-preview">
            {user.avatar ? (
              <img src={user.avatar} alt="Profile" className="avatar-image" />
            ) : (
              <div className="avatar-placeholder">
                {(displayName || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>

          {/* Username Input */}
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <div className="input-with-status">
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="Choose a username"
                maxLength={20}
                autoComplete="off"
                className={usernameStatus.available === true ? 'valid' : usernameStatus.available === false ? 'invalid' : ''}
              />
              {isChecking && <span className="checking-indicator">⟳</span>}
              {!isChecking && usernameStatus.available === true && <span className="status-icon valid">✓</span>}
              {!isChecking && usernameStatus.available === false && <span className="status-icon invalid">✗</span>}
            </div>
            {usernameStatus.message && (
              <span className={`input-hint ${usernameStatus.available ? 'valid' : 'invalid'}`}>
                {usernameStatus.message}
              </span>
            )}
            <span className="input-helper">Letters, numbers, and underscores only</span>
          </div>

          {/* Display Name Input */}
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we call you?"
              maxLength={50}
            />
            <span className="input-helper">This is how other players will see you</span>
          </div>

          {/* Error Message */}
          {error && <div className="error-message">{error}</div>}

          {/* Submit Button */}
          <button
            type="submit"
            className="submit-btn"
            disabled={!usernameStatus.available || isSubmitting}
          >
            {isSubmitting ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>

        <p className="setup-note">
          You can change these settings later in your profile
        </p>
      </div>
    </div>
  );
}

export default ProfileSetup;
