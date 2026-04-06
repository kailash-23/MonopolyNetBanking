# Monopoly Net Banking - Companion App

An open-source, fan-made companion app for Monopoly board game enthusiasts. This app provides a digital banking experience for your physical Monopoly games.

## ⚠️ Important Disclaimer

**MONOPOLY®** is a registered trademark of Hasbro, Inc. This application is **NOT affiliated with, endorsed by, or sponsored by Hasbro, Inc.** in any way.

This is an unofficial, fan-made, open-source project created for educational and entertainment purposes only. **A physical Monopoly® board game is required to play.**

## Features

Currently implemented:
- ✅ Hybrid authentication: Firebase email/password + Google OAuth 2.0
- ✅ Secure Express + MongoDB backend with JWT + Firebase token verification
- ✅ Mobile-friendly, accessible UI
- ✅ Clean component architecture

Coming soon:
- 🔄 Game lobby and player management
- 🔄 Digital banking transactions
- 🔄 Transaction history

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/monopoly-net-banking.git
cd monopoly-net-banking
```
2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd server
npm install
cd ..
```

4. Configure frontend environment variables:

Create a `.env.local` file in the project root (Vite automatically loads it) and add your Firebase web credentials:

```
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
# Optional when your API lives on another domain (defaults to same origin)
VITE_API_URL=https://your-backend.example.com
```

5. Configure backend environment variables:

Create a `server/.env` file (or edit the existing sample) with:

```
# Core settings
MONGO_URI=mongodb+srv://...
JWT_SECRET=generate-a-long-random-string
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=another-long-random-string   # optional, falls back to JWT_SECRET

# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-backend.example.com/api/auth/google/callback
```

> **Tip:** Register the OAuth client in [Google Cloud Console](https://console.cloud.google.com/). Add both your local callback (`http://localhost:4000/api/auth/google/callback`) and production callback under **Authorized redirect URIs**.

6. Provide Firebase Admin credentials for the backend (required for email/password flows):

- Option A: Set one environment variable before starting the server
  ```
  FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
  ```
- Option B (recommended for local dev): copy your downloaded service account JSON to `server/config/firebase-service-account.json`. The file is gitignored and automatically loaded. You can also point to a custom path with `FIREBASE_SERVICE_ACCOUNT_FILE=/absolute/path/to/credentials.json`.

7. Start the backend API:
```bash
cd server
npm run dev
```

8. In a separate terminal, start the Vite development server (with API proxying to port 4000):
```bash
npm run dev
```

9. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Google sign-in flow

Clicking "Continue with Google" now redirects the browser to `GET /api/auth/google` on the Express backend. After a successful OAuth handshake, the backend issues a signed JWT and redirects the user to `/oauth-success` on the frontend. That page stores the token, fetches the user profile via `GET /api/auth/me`, and then sends the player to their dashboard (or profile setup). Email/password users continue to authenticate with Firebase, so both tokens remain supported across the API.

### Migrating existing MongoDB users to Firebase Auth

If you have legacy users that only exist in MongoDB, run the migration script to create matching Firebase Auth accounts and fill in each document's `firebaseUid`.

1. Ensure `MONGO_URI` and your Firebase Admin credentials are configured.
2. Dry-run to see what would happen:
   ```bash
   npm run migrate:users -- --dry-run
   ```
3. Execute the real migration:
   ```bash
   npm run migrate:users
   ```

The script links to existing Firebase accounts when possible and only creates new ones for users with an email address. Any failures are summarized at the end so you can re-run the tool after fixing data issues. Newly created accounts receive a random temporary password, so migrated players should use the "Forgot password" option to set their own credentials.

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── AuthLayout.jsx   # Layout wrapper for auth pages
│   ├── Button.jsx       # Button component
│   ├── Disclaimer.jsx   # Legal disclaimer component
│   └── Input.jsx        # Form input component
├── pages/               # Page components
│   ├── SignIn.jsx       # Sign in page
│   └── SignUp.jsx       # Sign up page
├── services/            # API services
│   └── authService.js   # Authentication service (mock)
├── styles/              # Global styles
│   └── index.css        # Base CSS reset and utilities
├── App.jsx              # Main app with routing
└── main.jsx             # App entry point
```

## Backend Integration

The `authService.js` file contains stub implementations that can be easily replaced with actual API calls. Each method includes TODO comments showing how to integrate with a real backend.

Example:
```javascript
// Current mock implementation
async signIn({ username, password }) {
  await simulateDelay();
  // Mock logic...
}

// Replace with:
async signIn({ username, password }) {
  const response = await fetch('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error('Authentication failed');
  return response.json();
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

---

**Remember:** This is a companion app only. You need a physical Monopoly® board game to play!
