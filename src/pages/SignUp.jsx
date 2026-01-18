import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { authService } from '../services/authService';
import mrMonopolyImg from '../mrMonopoly.png';
import './AuthPages.css';

function SignUp() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [socialLoading, setSocialLoading] = useState(null);

  // Google OAuth login
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSocialLoading('google');
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        
        // Send user info directly to backend
        await authService.signInWithGoogle({
          googleId: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        });
        navigate('/dashboard');
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

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Only letters, numbers, and underscores allowed';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      await authService.signUp({
        username: formData.username,
        password: formData.password,
      });
      navigate('/', { state: { message: 'Account created! Please sign in.' } });
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
              <label htmlFor="username" className="field__label">Username</label>
              <input
                id="username"
                type="text"
                className={'field__input ' + (errors.username ? 'field__input--error' : '')}
                value={formData.username}
                onChange={handleChange('username')}
                placeholder="Choose a username"
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
                placeholder="Create a password"
                autoComplete="new-password"
              />
              {errors.password && <span className="field__error">{errors.password}</span>}
            </div>

            <div className="field">
              <label htmlFor="confirmPassword" className="field__label">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                className={'field__input ' + (errors.confirmPassword ? 'field__input--error' : '')}
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                placeholder="Confirm your password"
                autoComplete="new-password"
              />
              {errors.confirmPassword && <span className="field__error">{errors.confirmPassword}</span>}
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
