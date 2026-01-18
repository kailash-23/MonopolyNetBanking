import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { SignIn, SignUp, Friends } from './pages';
import Dashboard from './pages/Dashboard';
import ProfileSetup from './pages/ProfileSetup';
import Settings from './pages/Settings';
import Terms from './pages/Terms';
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
    </Routes>
  );
}

export default App;
