import "./config/loadEnv.js";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import session from "express-session";
import passport from "passport";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import friendsRoutes from "./routes/friends.js";
import gamesRoutes from "./routes/games.js";
import "./config/passport.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;

if (!sessionSecret) {
  throw new Error("SESSION_SECRET or JWT_SECRET must be provided");
}

if (isProduction) {
  app.set("trust proxy", 1);
}

// Middleware
app.use(cors({
  origin: [
    "http://localhost:3000", 
    "http://localhost:3001",
    "http://localhost:5173",
    "https://monopolynetbanking.netlify.app",  // Your Netlify domain
    process.env.FRONTEND_URL  // Backup from env variable
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
}));
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting configuration
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 1200 : 100000,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (!isProduction) return true;
    // Game session polling is frequent; apply dedicated limiter for /api/games.
    return req.path.startsWith('/api/games') || req.path === '/api/health';
  },
});

// Stricter rate limit for auth routes (login, register, password reset)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 30 : 1000,
  message: { message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
});

// Dedicated game limiter to support lobby/session polling for multiple players.
const gamesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 4000 : 200000,
  message: { message: 'Too many game requests, please wait a moment and retry.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
});

// Apply general rate limiting to all routes
app.use(generalLimiter);

// Routes
console.log("Registering auth routes...");
app.use("/api/auth", authLimiter, authRoutes);
console.log("Registering friends routes...");
app.use("/api/friends", friendsRoutes);
console.log("Registering games routes...");
app.use("/api/games", gamesLimiter, gamesRoutes);
console.log("All routes registered successfully!");

// Debug endpoint to check routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    routes: ["auth", "friends", "games"],
    timestamp: new Date().toISOString()
  });
});

app.get("/", (req, res) => {
  res.send("Backend running");
});

const PORT = process.env.PORT || 4000;

// Validate required environment variables
const validateEnv = () => {
  const requiredVars = ['JWT_SECRET', 'MONGO_URI'];
  const missing = requiredVars.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  
  // Warn about insecure JWT_SECRET in production
  const insecureSecrets = ['change-this-later', 'your-secret-key', 'secret', 'jwt-secret'];
  if (insecureSecrets.includes(process.env.JWT_SECRET.toLowerCase())) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: Insecure JWT_SECRET detected in production. Please set a secure secret.');
      process.exit(1);
    } else {
      console.warn('WARNING: Using insecure JWT_SECRET. Set a secure value before deploying to production.');
    }
  }

  const googleVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const googleProvided = googleVars.map((v) => Boolean(process.env[v]));
  if (googleProvided.some(Boolean) && googleProvided.some((flag) => !flag)) {
    console.warn('WARNING: Google OAuth env vars are partially configured. Provide both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.');
  }
};

// Start server after database connection
const startServer = async () => {
  try {
    validateEnv();
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
