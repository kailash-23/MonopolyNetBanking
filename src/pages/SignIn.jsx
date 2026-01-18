import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { authService } from '../services/authService';
import mrMonopolyImg from '../mrMonopoly.png';
import './AuthPages.css';

function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [socialLoading, setSocialLoading] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Auto sign-in if already authenticated
  useEffect(() => {
    const checkExistingSession = async () => {
      const user = authService.getCurrentUser();
      const token = localStorage.getItem('authToken');
      
      if (user && token) {
        // User is already signed in, redirect to dashboard
        if (user.isProfileComplete === false) {
          navigate('/profile-setup', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        setCheckingAuth(false);
      }
    };
    
    checkExistingSession();
  }, [navigate]);

  // Google OAuth login
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSocialLoading('google');
      try {
        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        
        // Send user info directly to backend
        const result = await authService.signInWithGoogle({
          googleId: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        });
        
        // Redirect new users to profile setup, existing users to dashboard
        if (result.isNewUser) {
          navigate('/profile-setup');
        } else {
          navigate('/dashboard');
        }
      } catch (error) {
        setGeneralError(error.message || 'Google authentication failed.');
      } finally {
        setSocialLoading(null);
      }
    },
    onError: () => {
      setGeneralError('Google authentication failed.');
      setSocialLoading(null);
    },
  });

  // Apple login handler
  const handleAppleLogin = () => {
    setSocialLoading('apple');
    
    if (window.AppleID) {
      window.AppleID.auth.signIn()
        .then((response) => {
          const { id_token, user } = response.authorization;
          return authService.signInWithApple(id_token, user);
        })
        .then(() => navigate('/dashboard'))
        .catch((error) => {
          if (error.error !== 'popup_closed_by_user') {
            setGeneralError(error.message || 'Apple authentication failed.');
          }
        })
        .finally(() => setSocialLoading(null));
    } else {
      setGeneralError('Apple Sign In not available.');
      setSocialLoading(null);
    }
  };

  // Handle browser back gesture/button
  useEffect(() => {
    if (showForm) {
      window.history.pushState({ showForm: true }, '');
      
      const handlePopState = () => {
        setShowForm(false);
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [showForm]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
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
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      await authService.signIn({
        username: formData.username,
        password: formData.password,
      });
      navigate('/dashboard');
    } catch (error) {
      setGeneralError(error.message || 'Invalid username or password.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <div className="auth-page">
        <div className="bg-blob bg-blob--pink"></div>
        <div className="bg-blob bg-blob--beige"></div>
        <div className="bg-blob bg-blob--purple"></div>
        <div className="auth-loading">
          <img src={mrMonopolyImg} alt="Mr. Monopoly" className="welcome-mascot" draggable="false" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Welcome view (initial)
  if (!showForm && !successMessage) {
    return (
      <div className="auth-page">
        <div className="bg-blob bg-blob--pink"></div>
        <div className="bg-blob bg-blob--beige"></div>
        <div className="bg-blob bg-blob--purple"></div>

        <div className="welcome-wrapper">
          <img 
            src={mrMonopolyImg} 
            alt="Mr. Monopoly" 
            className="welcome-mascot" 
            draggable="false"
            onContextMenu={(e) => e.preventDefault()}
          />
          <div className="welcome-brand">
            <h1 className="welcome-brand__name">Mono<span>Pay</span></h1>
          </div>
          
          <p className="welcome-tagline">Your Monopoly companion for cashless gaming</p>

          <button className="btn-continue" onClick={() => setShowForm(true)}>
            Continue
          </button>

          <div className="welcome-links">
            <button className="link-btn" onClick={() => setShowForm(true)}>Sign In</button>
            <span className="link-divider">•</span>
            <Link to="/signup" className="link-btn">Create Account</Link>
          </div>

          <div className="disclaimer">
            <p>Fan-made Monopoly Companion WebApp</p>
            <p>Not affiliated with or endorsed by Hasbro MONOPOLY®</p>
          </div>
        </div>
      </div>
    );
  }

  // Sign In form view
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
          <h2 className="auth-card__heading">Welcome Back</h2>
          <p className="auth-card__subheading">Sign in to continue</p>

          {successMessage && (
            <div className="alert alert--success">{successMessage}</div>
          )}
          {generalError && (
            <div className="alert alert--error">{generalError}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field">
              <label htmlFor="username" className="field__label">Username</label>
              <input
                id="username"
                type="text"
                className={'field__input ' + (errors.username ? 'field__input--error' : '')}
                value={formData.username}
                onChange={handleChange('username')}
                placeholder="Enter your username"
                autoComplete="username"
              />
              {errors.username && <span className="field__error">{errors.username}</span>}
            </div>

            <div className="field">
              <label htmlFor="password" className="field__label">Password</label>
              <input
                id="password"
                type="password"
                className={'field__input ' + (errors.password ? 'field__input--error' : '')}
                value={formData.password}
                onChange={handleChange('password')}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              {errors.password && <span className="field__error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="divider">
            <span>or continue with</span>
          </div>

          <div className="social-row">
            <button 
              type="button" 
              className="social-btn" 
              onClick={() => googleLogin()}
              disabled={socialLoading === 'google'}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {socialLoading === 'google' ? '...' : 'Google'}
            </button>

            <button 
              type="button" 
              className="social-btn" 
              onClick={handleAppleLogin}
              disabled={socialLoading === 'apple'}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#000">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              {socialLoading === 'apple' ? '...' : 'Apple'}
            </button>
          </div>

          <p className="auth-switch">
            Don't have an account? <Link to="/signup">Create Account</Link>
          </p>
        </div>

        <div className="disclaimer">
          <p>Fan-made Monopoly companion WebApp</p>
          <p>Not affiliated with or endorsed by Hasbro MONOPOLY®</p>
        </div>
      </div>
    </div>
  );
}

export default SignIn;
