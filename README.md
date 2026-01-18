# Monopoly Net Banking - Companion App

An open-source, fan-made companion app for Monopoly board game enthusiasts. This app provides a digital banking experience for your physical Monopoly games.

## ⚠️ Important Disclaimer

**MONOPOLY®** is a registered trademark of Hasbro, Inc. This application is **NOT affiliated with, endorsed by, or sponsored by Hasbro, Inc.** in any way.

This is an unofficial, fan-made, open-source project created for educational and entertainment purposes only. **A physical Monopoly® board game is required to play.**

## Features

Currently implemented:
- ✅ User authentication (Sign Up / Sign In)
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

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

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
