import React from 'react';
import { Routes, Route } from 'react-router-dom';
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
import './styles/index.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/profile-setup" element={<ProfileSetup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/friends" element={<Friends />} />
      <Route path="/lobby/:code" element={<GameLobby />} />
      <Route path="/game/:code" element={<GameSession />} />
    </Routes>
  );
}

export default App;
