import React, { useEffect } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { 
  SignIn, 
  SignUp, 
  Friends, 
  Dashboard, 
  ProfileSetup, 
  Settings, 
  Terms,
  GameLobby,
  GameSession 
} from './pages';
import ErrorBoundary from './components/ErrorBoundary';
import { authService } from './services/authService';
import * as gameService from './services/gameService';
import './styles/index.css';

// JoinGame component - handles /join/:code links
function JoinGame() {
  const { code } = useParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleJoin = async () => {
      const user = authService.getCurrentUser();
      const token = localStorage.getItem('authToken');
      
      // If not logged in, redirect to sign in with return URL
      if (!user || !token) {
        // Store the code to join after login
        sessionStorage.setItem('pendingJoinCode', code);
        navigate('/signin', { state: { message: 'Please sign in to join the game' } });
        return;
      }
      
      try {
        // Try to join the game
        const data = await gameService.joinGame(code);
        navigate(`/lobby/${code}`, { state: { game: data.game } });
      } catch (err) {
        // If join fails, navigate to dashboard with error
        navigate('/dashboard', { state: { error: err.message } });
      }
    };
    
    handleJoin();
  }, [code, navigate]);
  
  return (
    <div className="loading-page">
      <div className="bg-blob bg-blob--pink"></div>
      <div className="bg-blob bg-blob--beige"></div>
      <div className="bg-blob bg-blob--purple"></div>
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Joining game...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/join/:code" element={<JoinGame />} />
        <Route path="/lobby/:code" element={<GameLobby />} />
        <Route path="/game/:code" element={<GameSession />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
