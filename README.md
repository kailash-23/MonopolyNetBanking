# Monopoly Net Banking - Companion App

An open-source, fan-made companion app for Monopoly board game enthusiasts. This app provides a digital banking experience for your physical Monopoly games.

## ⚠️ Important Disclaimer

**MONOPOLY®** is a registered trademark of Hasbro, Inc. This application is **NOT affiliated with, endorsed by, or sponsored by Hasbro, Inc.** in any way.

This is an unofficial, fan-made, open-source project created for educational and entertainment purposes only. **A physical Monopoly® board game is required to play.**

## Features

Currently implemented:
- ✅ MongoDB email/password authentication + JWT sessions
- ✅ Optional Google OAuth 2.0 via backend Passport strategy
- ✅ Secure Express + MongoDB backend with JWT verification
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

Create a `.env.local` file in the project root (Vite automatically loads it):

```
# Preferred key
VITE_API_URL=https://your-backend.example.com

# Optional alias supported by vite.config.js (useful for host dashboards)
BACKEND_URL=https://your-backend.example.com
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
# Alias also supported: GOOGLE_SECRET_ID
GOOGLE_CALLBACK_URL=https://your-backend.example.com/api/auth/google/callback
```

> **Tip:** Register the OAuth client in [Google Cloud Console](https://console.cloud.google.com/). Add both your local callback (`http://localhost:4000/api/auth/google/callback`) and production callback under **Authorized redirect URIs**.

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

Clicking "Continue with Google" redirects to `GET /api/auth/google` on the Express backend. After successful OAuth, the backend issues a JWT and redirects to `/oauth-success` on the frontend.

Email/password users authenticate directly through:
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/password-reset`
- `POST /api/auth/reset-password`

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
