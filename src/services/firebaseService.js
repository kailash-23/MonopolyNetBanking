import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyA6JkBcRyZeEL8BFOWVzww_VcRZQEhGAUQ',
  authDomain: 'monopolynetbanking.firebaseapp.com',
  projectId: 'monopolynetbanking',
  storageBucket: 'monopolynetbanking.firebasestorage.app',
  messagingSenderId: '967663906579',
  appId: '1:967663906579:web:5cfd0685292d065d0974e6',
};

const readEnvValue = (key) => {
  const raw = import.meta?.env?.[key];
  return typeof raw === 'string' ? raw.trim() : '';
};

const firebaseConfig = {
  apiKey: readEnvValue('VITE_FIREBASE_API_KEY') || fallbackFirebaseConfig.apiKey,
  authDomain: readEnvValue('VITE_FIREBASE_AUTH_DOMAIN') || fallbackFirebaseConfig.authDomain,
  projectId: readEnvValue('VITE_FIREBASE_PROJECT_ID') || fallbackFirebaseConfig.projectId,
  storageBucket: readEnvValue('VITE_FIREBASE_STORAGE_BUCKET') || fallbackFirebaseConfig.storageBucket,
  messagingSenderId:
    readEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID') || fallbackFirebaseConfig.messagingSenderId,
  appId: readEnvValue('VITE_FIREBASE_APP_ID') || fallbackFirebaseConfig.appId,
};

export const isFirebaseReady = Boolean(firebaseConfig.apiKey);

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
