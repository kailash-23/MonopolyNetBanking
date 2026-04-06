import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { onIdTokenChanged } from 'firebase/auth';
import App from './App';
import './styles/index.css';
import { auth } from './services/firebaseService';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

onIdTokenChanged(auth, async (user) => {
  if (user) {
    const token = await user.getIdToken();
    localStorage.setItem('authToken', token);
    localStorage.setItem('authSource', 'firebase');
  } else {
    const authSource = localStorage.getItem('authSource');
    if (!authSource || authSource === 'firebase') {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('authSource');
    }
  }
});
