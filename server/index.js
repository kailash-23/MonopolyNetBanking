import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import friendsRoutes from "./routes/friends.js";
import gamesRoutes from "./routes/games.js";

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const isProduction = process.env.NODE_ENV === "production";

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
