import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import mrMonopolyImg from '../mrMonopoly.png';
import './AuthPages.css';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;

async function signInWithBackend({ email, password }) {
  const response = await fetch(apiUrl('/api/auth/signin'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message || 'Unable to sign in.');
  }

  if (data?.token) {
    localStorage.setItem('authToken', data.token);
  }
  localStorage.setItem('authSource', 'custom');
  if (data?.user) {
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  return data || {};
}

function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState(location.state?.message || '');
  const [socialLoading, setSocialLoading] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Show session expired message if redirected due to expired session
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('sessionExpired') === 'true') {
      setGeneralError('Your session has expired. Please sign in again.');
      // Clean up the URL
      window.history.replaceState({}, '', '/signin');
    }
  }, [location.search]);

  // Auto sign-in if already authenticated
  useEffect(() => {
    const checkExistingSession = async () => {
      const storedUserRaw = localStorage.getItem('user');
      const token = localStorage.getItem('authToken');

      if (storedUserRaw && token) {
        try {
          const storedUser = JSON.parse(storedUserRaw);
          if (storedUser?.isProfileComplete === false) {
            navigate('/profile-setup', { replace: true });
            return;
          }
          navigate('/dashboard', { replace: true });
        } catch (error) {
          console.error('Stored user parse error:', error);
          localStorage.removeItem('user');
          setCheckingAuth(false);
        }
      } else {
        setCheckingAuth(false);
      }
    };
    
    checkExistingSession();
  }, [navigate]);

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
      console.error('Google authentication redirect error:', error);
      setGeneralError('Unable to start Google sign-in. Please try again.');
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
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      const data = await signInWithBackend({
        email: formData.email.trim(),
        password: formData.password,
      });
      redirectAfterSync(data);
    } catch (error) {
      console.error('Email/password sign-in error:', error);
      setGeneralError(error.message || 'Unable to sign in. Please try again.');
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
              {socialLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
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
