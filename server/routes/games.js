import express from "express";
import jwt from "jsonwebtoken";
import Game from "../models/Game.js";
import User from "../models/User.js";

const router = express.Router();

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired. Please sign in again." });
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

// @route   POST /api/games/create
// @desc    Create a new game session
// @access  Private
router.post("/create", authenticate, async (req, res) => {
  try {
    const { name, maxPlayers, startingBalance, goSalary, settings } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Game name is required" });
    }

    // Check if user is already in an active game
    const existingGame = await Game.findOne({
      "players.user": req.user._id,
      status: { $in: ["waiting", "in_progress", "paused"] },
    });

    if (existingGame) {
      return res.status(400).json({ 
        message: "You are already in an active game",
        gameCode: existingGame.code 
      });
    }

    // Create new game
    const game = new Game({
      name,
      host: req.user._id,
      maxPlayers: maxPlayers || 8,
      startingBalance: startingBalance || 1500,
      goSalary: goSalary || 200,
      settings: settings || {},
    });

    // Add host as first player
    game.addPlayer(req.user._id, true);

    await game.save();

    // Populate player info
    await game.populate("players.user", "username displayName avatar uid");
    await game.populate("host", "username displayName avatar uid");

    res.status(201).json({
      message: "Game created successfully",
      game: {
        id: game._id,
        code: game.code,
        name: game.name,
        host: game.host,
        players: game.players,
        maxPlayers: game.maxPlayers,
        startingBalance: game.startingBalance,
        goSalary: game.goSalary,
        status: game.status,
        settings: game.settings,
        playerCount: game.playerCount,
        createdAt: game.createdAt,
      },
    });
  } catch (error) {
    console.error("Create game error:", error);
    res.status(500).json({ message: "Error creating game", error: error.message });
  }
});

// @route   POST /api/games/join
// @desc    Join a game using 6-digit code
// @access  Private
router.post("/join", authenticate, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Game code is required" });
    }

    // Find game by code
    const game = await Game.findOne({ 
      code: code.toUpperCase(),
      status: "waiting" 
    });

    if (!game) {
      return res.status(404).json({ message: "Game not found or already started" });
    }

    // Check if user is already in another active game
    const existingGame = await Game.findOne({
      "players.user": req.user._id,
      status: { $in: ["waiting", "in_progress", "paused"] },
      _id: { $ne: game._id },
    });

    if (existingGame) {
      return res.status(400).json({ 
        message: "You are already in another active game",
        gameCode: existingGame.code 
      });
    }

    // Check if already in this game
    const alreadyInGame = game.players.some(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (alreadyInGame) {
      await game.populate("players.user", "username displayName avatar uid");
      await game.populate("host", "username displayName avatar uid");
      
      return res.json({
        message: "Already in this game",
        game: {
          id: game._id,
          code: game.code,
          name: game.name,
          host: game.host,
          players: game.players,
          maxPlayers: game.maxPlayers,
          startingBalance: game.startingBalance,
          goSalary: game.goSalary,
          status: game.status,
          settings: game.settings,
          playerCount: game.playerCount,
        },
      });
    }

    // Add player to game
    try {
      game.addPlayer(req.user._id, false);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    await game.save();

    // Populate player info
    await game.populate("players.user", "username displayName avatar uid");
    await game.populate("host", "username displayName avatar uid");

    res.json({
      message: "Joined game successfully",
      game: {
        id: game._id,
        code: game.code,
        name: game.name,
        host: game.host,
        players: game.players,
        maxPlayers: game.maxPlayers,
        startingBalance: game.startingBalance,
        goSalary: game.goSalary,
        status: game.status,
        settings: game.settings,
        playerCount: game.playerCount,
      },
    });
  } catch (error) {
    console.error("Join game error:", error);
    res.status(500).json({ message: "Error joining game", error: error.message });
  }
});

// @route   POST /api/games/leave
// @desc    Leave a game
// @access  Private
router.post("/leave", authenticate, async (req, res) => {
  try {
    const { gameId } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const isHost = game.host.toString() === req.user._id.toString();
    const playerInGame = game.players.some(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!playerInGame) {
      return res.status(400).json({ message: "You are not in this game" });
    }

    if (isHost) {
      // If host leaves, end the game or transfer host
      if (game.players.length > 1) {
        // Transfer host to next player
        game.removePlayer(req.user._id);
        const newHost = game.players[0];
        newHost.isHost = true;
        game.host = newHost.user;
      } else {
        // No other players, end the game
        game.status = "finished";
        game.finishedAt = new Date();
      }
    } else {
      game.removePlayer(req.user._id);
    }

    await game.save();

    res.json({ message: "Left game successfully" });
  } catch (error) {
    console.error("Leave game error:", error);
    res.status(500).json({ message: "Error leaving game", error: error.message });
  }
});

// @route   GET /api/games/:code
// @desc    Get game by code
// @access  Private
router.get("/:code", authenticate, async (req, res) => {
  try {
    const game = await Game.findOne({ code: req.params.code.toUpperCase() })
      .populate("players.user", "username displayName avatar uid")
      .populate("host", "username displayName avatar uid");

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json({
      game: {
        id: game._id,
        code: game.code,
        name: game.name,
        host: game.host,
        players: game.players,
        maxPlayers: game.maxPlayers,
        startingBalance: game.startingBalance,
        goSalary: game.goSalary,
        status: game.status,
        settings: game.settings,
        playerCount: game.playerCount,
        transactions: game.transactions,
        createdAt: game.createdAt,
        startedAt: game.startedAt,
      },
    });
  } catch (error) {
    console.error("Get game error:", error);
    res.status(500).json({ message: "Error getting game", error: error.message });
  }
});

// @route   GET /api/games/my/active
// @desc    Get user's active game
// @access  Private
router.get("/my/active", authenticate, async (req, res) => {
  try {
    const game = await Game.findOne({
      "players.user": req.user._id,
      status: { $in: ["waiting", "in_progress", "paused"] },
    })
      .populate("players.user", "username displayName avatar uid")
      .populate("host", "username displayName avatar uid");

    if (!game) {
      return res.json({ game: null });
    }

    res.json({
      game: {
        id: game._id,
        code: game.code,
        name: game.name,
        host: game.host,
        players: game.players,
        maxPlayers: game.maxPlayers,
        startingBalance: game.startingBalance,
        goSalary: game.goSalary,
        status: game.status,
        settings: game.settings,
        playerCount: game.playerCount,
        createdAt: game.createdAt,
      },
    });
  } catch (error) {
    console.error("Get active game error:", error);
    res.status(500).json({ message: "Error getting active game", error: error.message });
  }
});

// @route   POST /api/games/ready
// @desc    Toggle ready status
// @access  Private
router.post("/ready", authenticate, async (req, res) => {
  try {
    const { gameId } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const player = game.players.find(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!player) {
      return res.status(400).json({ message: "You are not in this game" });
    }

    player.isReady = !player.isReady;
    await game.save();

    await game.populate("players.user", "username displayName avatar uid");

    res.json({
      message: player.isReady ? "You are ready" : "You are not ready",
      players: game.players,
    });
  } catch (error) {
    console.error("Ready toggle error:", error);
    res.status(500).json({ message: "Error toggling ready status", error: error.message });
  }
});

// @route   POST /api/games/start
// @desc    Start the game (host only)
// @access  Private
router.post("/start", authenticate, async (req, res) => {
  try {
    const { gameId } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can start the game" });
    }

    if (game.status !== "waiting") {
      return res.status(400).json({ message: "Game has already started" });
    }

    if (game.players.length < 2) {
      return res.status(400).json({ message: "Need at least 2 players to start" });
    }

    // Check if all players are ready
    const allReady = game.players.every((p) => p.isReady);
    if (!allReady) {
      return res.status(400).json({ message: "Not all players are ready" });
    }

    game.status = "in_progress";
    game.startedAt = new Date();
    await game.save();

    await game.populate("players.user", "username displayName avatar uid");
    await game.populate("host", "username displayName avatar uid");

    res.json({
      message: "Game started",
      game: {
        id: game._id,
        code: game.code,
        name: game.name,
        host: game.host,
        players: game.players,
        status: game.status,
        startedAt: game.startedAt,
      },
    });
  } catch (error) {
    console.error("Start game error:", error);
    res.status(500).json({ message: "Error starting game", error: error.message });
  }
});

// @route   POST /api/games/transfer
// @desc    Transfer money between players or from/to bank
// @access  Private
router.post("/transfer", authenticate, async (req, res) => {
  try {
    const { gameId, toPlayerId, amount, type, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.status !== "in_progress") {
      return res.status(400).json({ message: "Game is not in progress" });
    }

    const fromPlayer = game.players.find(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!fromPlayer) {
      return res.status(400).json({ message: "You are not in this game" });
    }

    let toPlayer = null;
    
    if (type === "transfer" || type === "rent") {
      // Player to player transfer
      if (!toPlayerId) {
        return res.status(400).json({ message: "Recipient is required" });
      }

      toPlayer = game.players.find(
        (p) => p.user.toString() === toPlayerId
      );

      if (!toPlayer) {
        return res.status(400).json({ message: "Recipient not found in game" });
      }

      if (fromPlayer.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      fromPlayer.balance -= amount;
      toPlayer.balance += amount;
    } else if (type === "bank_pay" || type === "tax" || type === "purchase") {
      // Player pays bank
      if (fromPlayer.balance < amount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      fromPlayer.balance -= amount;
    } else if (type === "bank_receive" || type === "go_salary") {
      // Bank pays player
      fromPlayer.balance += amount;
    }

    // Record transaction
    game.recordTransaction(
      req.user._id,
      toPlayer ? toPlayer.user : null,
      amount,
      type,
      description
    );

    await game.save();

    await game.populate("players.user", "username displayName avatar uid");

    res.json({
      message: "Transaction successful",
      players: game.players,
      transaction: game.transactions[game.transactions.length - 1],
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ message: "Error processing transfer", error: error.message });
  }
});

// @route   POST /api/games/end
// @desc    End the game (host only)
// @access  Private
router.post("/end", authenticate, async (req, res) => {
  try {
    const { gameId } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can end the game" });
    }

    game.status = "finished";
    game.finishedAt = new Date();
    await game.save();

    await game.populate("players.user", "username displayName avatar uid");

    res.json({
      message: "Game ended",
      game: {
        id: game._id,
        code: game.code,
        name: game.name,
        players: game.players,
        status: game.status,
        finishedAt: game.finishedAt,
      },
    });
  } catch (error) {
    console.error("End game error:", error);
    res.status(500).json({ message: "Error ending game", error: error.message });
  }
});

export default router;
