import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import mrMonopolyImg from '../mrMonopoly.png';
import './AuthPages.css';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;

function OAuthSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Finishing sign-in...');
  const [error, setError] = useState('');

  useEffect(() => {
    const finalizeLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      const token = params.get('token');
      const needsProfileSetupFlag = params.get('needsProfileSetup') === '1';

      if (errorParam) {
        setError('Google sign-in failed. Please try again.');
        return;
      }

      if (!token) {
        setError('Missing authentication token. Please try signing in again.');
        return;
      }

      try {
        localStorage.setItem('authToken', token);
        localStorage.setItem('authSource', 'custom');
        setStatus('Syncing your profile...');

        const response = await fetch(apiUrl('/api/auth/me'), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.message || 'Failed to fetch user profile');
        }

        if (data?.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        window.history.replaceState({}, '', '/oauth-success');

        const userNeedsSetup = needsProfileSetupFlag || data?.user?.isProfileComplete === false;
        if (userNeedsSetup) {
          navigate('/profile-setup', { replace: true });
          return;
        }

        const pendingJoinCode = sessionStorage.getItem('pendingJoinCode');
        if (pendingJoinCode) {
          sessionStorage.removeItem('pendingJoinCode');
          navigate(`/join/${pendingJoinCode}`, { replace: true });
          return;
        }

        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('OAuth completion error:', err);
        setError(err.message || 'Unable to complete sign-in. Please try again.');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('authSource');
      }
    };

    finalizeLogin();
  }, [navigate]);

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
          {error ? (
            <>
              <h2 className="auth-card__heading">Sign-in issue</h2>
              <div className="alert alert--error">{error}</div>
              <button className="btn-primary" onClick={() => navigate('/signin', { replace: true })}>
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <h2 className="auth-card__heading">You're almost there</h2>
              <p className="auth-card__subheading">{status}</p>
              <div className="auth-loading">
                <div className="spinner"></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default OAuthSuccess;
