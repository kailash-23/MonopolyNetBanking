import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import friendsRoutes from "./routes/friends.js";
import gamesRoutes from "./routes/games.js";

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, ".env") });
connectDB();

const app = express();

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

// Routes
console.log("Registering auth routes...");
app.use("/api/auth", authRoutes);
console.log("Registering friends routes...");
app.use("/api/friends", friendsRoutes);
console.log("Registering games routes...");
app.use("/api/games", gamesRoutes);
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
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
