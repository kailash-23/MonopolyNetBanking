import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../services/firebaseService';
import mrMonopolyImg from '../mrMonopoly.png';
import './AuthPages.css';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;

async function syncUserProfile(firebaseUser) {
  const token = await firebaseUser.getIdToken();
  const response = await fetch(apiUrl('/api/auth/sync'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      displayName: firebaseUser.displayName || null,
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to sync user profile.');
  }

  localStorage.setItem('authToken', token);
  localStorage.setItem('authSource', 'firebase');
  if (data?.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  return data || {};
}

function SignUp() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [socialLoading, setSocialLoading] = useState(null);

  const redirectAfterSync = (syncData) => {
    if (syncData?.needsProfileSetup) {
      navigate('/profile-setup');
      return;
    }

    const pendingJoinCode = sessionStorage.getItem('pendingJoinCode');
    if (pendingJoinCode) {
      sessionStorage.removeItem('pendingJoinCode');
      navigate(`/join/${pendingJoinCode}`);
      return;
    }

    navigate('/dashboard');
  };

  const handleGoogleLogin = async () => {
    setSocialLoading('google');
    setGeneralError('');

    try {
      const googleAuthUrl = apiUrl('/api/auth/google');
      window.location.href = googleAuthUrl;
    } catch (error) {
      console.error('Google redirect error:', error);
      setGeneralError('Unable to start Google sign up. Please try again.');
      setSocialLoading(null);
    } finally {
      // If redirect succeeds, component will unload before this runs
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Display name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
    if (generalError) setGeneralError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      );

      await updateProfile(userCredential.user, {
        displayName: formData.name.trim() || 'Player',
      });

      const syncData = await syncUserProfile(userCredential.user);
      redirectAfterSync(syncData);
    } catch (error) {
      setGeneralError(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="bg-blob bg-blob--pink"></div>
      <div className="bg-blob bg-blob--beige"></div>
      <div className="bg-blob bg-blob--purple"></div>

      <div className="auth-wrapper">
        <div className="auth-brand">
          <img 
            src={mrMonopolyImg} 
            alt="Mr. Monopoly" 
            className="auth-mascot" 
            draggable="false"
            onContextMenu={(e) => e.preventDefault()}
          />
          <h1 className="auth-brand__name">Mono<span>Pay</span></h1>
        </div>

        <div className="auth-card">
          <h2 className="auth-card__heading">Create Account</h2>
          <p className="auth-card__subheading">Sign up to start playing</p>

          {generalError && (
            <div className="alert alert--error">{generalError}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field">
              <label htmlFor="name" className="field__label">Display Name</label>
              <input
                id="name"
                type="text"
                className={'field__input ' + (errors.name ? 'field__input--error' : '')}
                value={formData.name}
                onChange={handleChange('name')}
                placeholder="Enter your display name"
                autoComplete="name"
              />
              {errors.name && <span className="field__error">{errors.name}</span>}
            </div>

            <div className="field">
              <label htmlFor="email" className="field__label">Email</label>
              <input
                id="email"
                type="email"
                className={'field__input ' + (errors.email ? 'field__input--error' : '')}
                value={formData.email}
                onChange={handleChange('email')}
                placeholder="Enter your email"
                autoComplete="email"
              />
              {errors.email && <span className="field__error">{errors.email}</span>}
            </div>

            <div className="field">
              <label htmlFor="password" className="field__label">Password</label>
              <input
                id="password"
                type="password"
                className={'field__input ' + (errors.password ? 'field__input--error' : '')}
                value={formData.password}
                onChange={handleChange('password')}
                placeholder="Create a password"
                autoComplete="new-password"
              />
              {errors.password && <span className="field__error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="divider">
            <span>or sign up with</span>
          </div>

          <div className="social-row">
            <button 
              type="button" 
              className="social-btn social-btn--full" 
              onClick={handleGoogleLogin}
              disabled={socialLoading === 'google'}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {socialLoading === 'google' ? 'Redirecting...' : 'Sign up with Google'}
            </button>
          </div>

          <p className="auth-switch">
            Already have an account? <Link to="/">Sign In</Link>
          </p>
        </div>

        <div className="disclaimer">
          <p>This is an open-source, fan-made companion app for the physical Monopoly board game.</p>
          <p>MONOPOLY® is a trademark of Hasbro, Inc. This app is not affiliated with or endorsed by Hasbro.</p>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
