import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
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

    const game = await Game.findById(gameId)
      .populate("players.user", "username displayName avatar uid")
      .populate("host", "username displayName avatar uid");
      
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const isHost = game.host._id.toString() === req.user._id.toString();
    const playerInGame = game.players.some(
      (p) => (p.user._id || p.user).toString() === req.user._id.toString()
    );

    if (!playerInGame) {
      return res.status(400).json({ message: "You are not in this game" });
    }

    // Capture game info before modifications
    const gameInfo = {
      id: game._id,
      code: game.code,
      name: game.name,
      players: game.players.map(p => ({
        displayName: p.user?.displayName || p.user?.username,
        balance: p.balance,
        color: p.color,
      })),
      wasInProgress: game.status === "in_progress",
      startedAt: game.startedAt,
    };

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
        // If game was in progress, save it as host_left so it can be resumed
        if (gameInfo.wasInProgress) {
          game.endReason = "host_left";
        } else {
          game.endReason = "manual";
        }
      }
    } else {
      game.removePlayer(req.user._id);
    }

    await game.save();

    res.json({ 
      message: "Left game successfully",
      gameInfo,
    });
  } catch (error) {
    console.error("Leave game error:", error);
    res.status(500).json({ message: "Error leaving game", error: error.message });
  }
});

// @route   GET /api/games/saved
// @desc    Get user's saved games (games that can be resumed - idle_timeout or host_left)
// @access  Private
router.get("/saved", authenticate, async (req, res) => {
  try {
    const savedGames = await Game.find({
      host: req.user._id,
      status: "finished",
      endReason: { $in: ["idle_timeout", "host_left", "saved"] },
    })
      .populate("players.user", "username displayName avatar uid")
      .populate("host", "username displayName avatar uid")
      .sort({ finishedAt: -1 })
      .limit(10);

    res.json({
      savedGames: savedGames.map((game) => ({
        id: game._id,
        code: game.code,
        name: game.name,
        host: game.host,
        players: game.players,
        startingBalance: game.startingBalance,
        goSalary: game.goSalary,
        finishedAt: game.finishedAt,
        endReason: game.endReason,
        playerCount: game.playerCount,
      })),
    });
  } catch (error) {
    console.error("Get saved games error:", error);
    res.status(500).json({ message: "Error getting saved games", error: error.message });
  }
});

// @route   GET /api/games/:code
// @desc    Get game by code
// @access  Private
router.get("/:code([A-Za-z0-9]{6})", authenticate, async (req, res) => {
  try {
    const game = await Game.findOne({ code: req.params.code.toUpperCase() })
      .populate("players.user", "username displayName avatar uid")
      .populate("host", "username displayName avatar uid")
      .populate("pendingApprovals.player", "username displayName avatar uid")
      .populate("pendingApprovals.approver", "username displayName avatar uid");

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
        pendingApprovals: game.pendingApprovals,
        createdAt: game.createdAt,
        startedAt: game.startedAt,
        lastActivity: game.lastActivity,
        endReason: game.endReason,
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

// @route   POST /api/games/select-token
// @desc    Select a Monopoly token/piece
// @access  Private
router.post("/select-token", authenticate, async (req, res) => {
  try {
    const { gameId, token } = req.body;

    const validTokens = ["dog", "car", "hat", "iron", "boot", "battleship", "wheelbarrow", "thimble", "horse", "train", "cannon"];
    if (!validTokens.includes(token)) {
      return res.status(400).json({ message: "Invalid token" });
    }

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

    // Check if token is already taken by another player
    const tokenTaken = game.players.find(
      (p) => p.token === token && p.user.toString() !== req.user._id.toString()
    );
    if (tokenTaken) {
      return res.status(400).json({ message: "Token already taken by another player" });
    }

    player.token = token;
    await game.save();

    await game.populate("players.user", "username displayName avatar uid");

    res.json({
      message: "Token selected",
      players: game.players,
    });
  } catch (error) {
    console.error("Select token error:", error);
    res.status(500).json({ message: "Error selecting token", error: error.message });
  }
});

// @route   PUT /api/games/settings
// @desc    Update game settings (host only, only in waiting state)
// @access  Private
router.put("/settings", authenticate, async (req, res) => {
  try {
    const { gameId, startingBalance, goSalary, maxPlayers } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can update settings" });
    }

    if (game.status !== "waiting") {
      return res.status(400).json({ message: "Cannot update settings after game has started" });
    }

    // Validate and update settings
    if (startingBalance !== undefined) {
      const validBalances = [1000, 1500, 2000, 2500, 3000];
      if (validBalances.includes(startingBalance)) {
        game.startingBalance = startingBalance;
        // Update all player balances to new starting balance
        game.players.forEach(player => {
          player.balance = startingBalance;
        });
      }
    }

    if (goSalary !== undefined) {
      const validSalaries = [100, 200, 300, 400, 500];
      if (validSalaries.includes(goSalary)) {
        game.goSalary = goSalary;
      }
    }

    if (maxPlayers !== undefined) {
      if (maxPlayers >= game.players.length && maxPlayers >= 2 && maxPlayers <= 8) {
        game.maxPlayers = maxPlayers;
      } else {
        return res.status(400).json({ message: "Invalid max players value" });
      }
    }

    await game.save();
    await game.populate("players.user", "username displayName avatar uid");
    await game.populate("host", "username displayName avatar uid");

    res.json({
      message: "Settings updated",
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
      },
    });
  } catch (error) {
    console.error("Update settings error:", error);
    res.status(500).json({ message: "Error updating settings", error: error.message });
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
    game.lastActivity = new Date();
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
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { gameId, toPlayerId, amount, type, description } = req.body;

    if (!amount || amount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Invalid amount" });
    }

    // Use findOneAndUpdate with session for atomicity
    const game = await Game.findById(gameId).session(session);
    if (!game) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.status !== "in_progress") {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Game is not in progress" });
    }

    const fromPlayerIndex = game.players.findIndex(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (fromPlayerIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "You are not in this game" });
    }

    const fromPlayer = game.players[fromPlayerIndex];
    let toPlayer = null;
    let toPlayerIndex = -1;
    
    if (type === "transfer" || type === "rent") {
      // Player to player transfer
      if (!toPlayerId) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Recipient is required" });
      }

      toPlayerIndex = game.players.findIndex(
        (p) => p.user.toString() === toPlayerId
      );

      if (toPlayerIndex === -1) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Recipient not found in game" });
      }

      toPlayer = game.players[toPlayerIndex];

      if (fromPlayer.balance < amount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: "Insufficient balance" });
      }

      fromPlayer.balance -= amount;
      toPlayer.balance += amount;
    } else if (type === "bank_pay" || type === "tax" || type === "purchase") {
      // Player pays bank
      if (fromPlayer.balance < amount) {
        await session.abortTransaction();
        session.endSession();
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

    // Update activity timestamp
    game.lastActivity = new Date();
    await game.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    await game.populate("players.user", "username displayName avatar uid");

    res.json({
      message: "Transaction successful",
      players: game.players,
      transaction: game.transactions[game.transactions.length - 1],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Transfer error:", error);
    res.status(500).json({ message: "Error processing transfer", error: error.message });
  }
});

// @route   POST /api/games/request-go
// @desc    Request GO salary (requires approval from host or another player if requester is host)
// @access  Private
router.post("/request-go", authenticate, async (req, res) => {
  try {
    const { gameId } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.status !== "in_progress") {
      return res.status(400).json({ message: "Game is not in progress" });
    }

    const player = game.players.find(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!player) {
      return res.status(400).json({ message: "You are not in this game" });
    }

    const isHost = game.host.toString() === req.user._id.toString();

    // Check if there's already a pending request from this player for GO
    const existingRequest = game.pendingApprovals.find(
      (r) => r.player.toString() === req.user._id.toString() && r.status === "pending" && r.type === "go_salary"
    );

    if (existingRequest) {
      return res.status(400).json({ message: "You already have a pending GO request" });
    }

    // If host is requesting, they need approval from another player
    // If player is requesting, they need approval from host
    let approver = null;
    if (isHost) {
      // Find another player to approve (first non-host player)
      const otherPlayer = game.players.find(
        (p) => p.user.toString() !== req.user._id.toString()
      );
      if (!otherPlayer) {
        return res.status(400).json({ message: "No other players to approve your request" });
      }
      approver = otherPlayer.user;
    } else {
      approver = game.host;
    }

    // Add the pending request
    game.pendingApprovals.push({
      player: req.user._id,
      approver: approver,
      type: "go_salary",
      amount: game.goSalary,
      description: "Passed GO - Collect salary",
      requestedAt: new Date(),
      status: "pending",
    });

    // Update activity timestamp
    game.lastActivity = new Date();
    await game.save();

    await game.populate("pendingApprovals.player", "username displayName avatar uid");
    await game.populate("pendingApprovals.approver", "username displayName avatar uid");
    await game.populate("players.user", "username displayName avatar uid");

    const message = isHost 
      ? "GO salary request sent to another player for approval"
      : "GO salary request sent to host for approval";

    res.json({
      message,
      pendingApprovals: game.pendingApprovals.filter(r => r.status === "pending"),
      players: game.players,
    });
  } catch (error) {
    console.error("Request GO error:", error);
    res.status(500).json({ message: "Error requesting GO salary", error: error.message });
  }
});

// @route   POST /api/games/request-bank-receive
// @desc    Request bank receive (requires approval from host or another player if requester is host)
// @access  Private
router.post("/request-bank-receive", authenticate, async (req, res) => {
  try {
    const { gameId, amount, description } = req.body;

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

    const player = game.players.find(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!player) {
      return res.status(400).json({ message: "You are not in this game" });
    }

    const isHost = game.host.toString() === req.user._id.toString();

    // If host is requesting, they need approval from another player
    // If player is requesting, they need approval from host
    let approver = null;
    if (isHost) {
      // Find another player to approve (first non-host player)
      const otherPlayer = game.players.find(
        (p) => p.user.toString() !== req.user._id.toString()
      );
      if (!otherPlayer) {
        return res.status(400).json({ message: "No other players to approve your request" });
      }
      approver = otherPlayer.user;
    } else {
      approver = game.host;
    }

    // Add the pending request
    game.pendingApprovals.push({
      player: req.user._id,
      approver: approver,
      type: "bank_receive",
      amount: amount,
      description: description || "Received from bank",
      requestedAt: new Date(),
      status: "pending",
    });

    // Update activity timestamp
    game.lastActivity = new Date();
    await game.save();

    await game.populate("pendingApprovals.player", "username displayName avatar uid");
    await game.populate("pendingApprovals.approver", "username displayName avatar uid");
    await game.populate("players.user", "username displayName avatar uid");

    const message = isHost 
      ? "Bank receive request sent to another player for approval"
      : "Bank receive request sent to host for approval";

    res.json({
      message,
      pendingApprovals: game.pendingApprovals.filter(r => r.status === "pending"),
      players: game.players,
    });
  } catch (error) {
    console.error("Request bank receive error:", error);
    res.status(500).json({ message: "Error requesting bank receive", error: error.message });
  }
});

// @route   POST /api/games/approve-request
// @desc    Approve or deny a pending approval request
// @access  Private
router.post("/approve-request", authenticate, async (req, res) => {
  try {
    const { gameId, requestId, approved } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.status !== "in_progress") {
      return res.status(400).json({ message: "Game is not in progress" });
    }

    // Find the pending request
    const request = game.pendingApprovals.id(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ message: "Request has already been processed" });
    }

    // Check if user is the designated approver
    if (request.approver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to approve this request" });
    }

    // Update request status
    request.status = approved ? "approved" : "denied";

    // If approved, add the amount to the player's balance
    if (approved) {
      const player = game.players.find(
        (p) => p.user.toString() === request.player.toString()
      );

      if (player) {
        player.balance += request.amount;

        // Record transaction
        game.recordTransaction(
          request.player,
          null,
          request.amount,
          request.type,
          request.description + " (Approved)"
        );
      }
    }

    // Update activity timestamp
    game.lastActivity = new Date();
    await game.save();

    await game.populate("pendingApprovals.player", "username displayName avatar uid");
    await game.populate("pendingApprovals.approver", "username displayName avatar uid");
    await game.populate("players.user", "username displayName avatar uid");

    const typeLabel = request.type === "go_salary" ? "GO salary" : "Bank receive";
    res.json({
      message: approved ? `${typeLabel} approved and paid` : `${typeLabel} request denied`,
      approved,
      pendingApprovals: game.pendingApprovals.filter(r => r.status === "pending"),
      players: game.players,
    });
  } catch (error) {
    console.error("Approve request error:", error);
    res.status(500).json({ message: "Error processing request", error: error.message });
  }
});

// @route   POST /api/games/save
// @desc    Save the game for later (host only) — pauses game, preserves all balances
// @access  Private
router.post("/save", authenticate, async (req, res) => {
  try {
    const { gameId } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can save the game" });
    }

    if (game.status !== "in_progress") {
      return res.status(400).json({ message: "Only an in-progress game can be saved" });
    }

    game.status = "finished";
    game.finishedAt = new Date();
    game.endReason = "saved";
    await game.save();

    await game.populate("players.user", "username displayName avatar uid");

    res.json({
      message: "Game saved successfully",
      game: {
        id: game._id,
        code: game.code,
        name: game.name,
        players: game.players,
        status: game.status,
        finishedAt: game.finishedAt,
        endReason: game.endReason,
      },
    });
  } catch (error) {
    console.error("Save game error:", error);
    res.status(500).json({ message: "Error saving game", error: error.message });
  }
});

// @route   POST /api/games/end
// @desc    End the game (host only)
// @access  Private
router.post("/end", authenticate, async (req, res) => {
  try {
    const { gameId, reason } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can end the game" });
    }

    game.status = "finished";
    game.finishedAt = new Date();
    game.endReason = reason || "manual";
    await game.save();

    await game.populate("players.user", "username displayName avatar uid");

    // Update stats for all players with net worth calculation
    try {
      const propertyData = { prices: {'Old Kent Road': 60, 'Whitechapel Road': 60, 'The Angel Islington': 100, 'Euston Road': 100, 'Pentonville Road': 120, 'Pall Mall': 140, 'Whitehall': 140, 'Northumberland Avenue': 160, 'Bow Street': 180, 'Marlborough Street': 180, 'Vine Street': 200, 'Strand': 220, 'Fleet Street': 220, 'Trafalgar Square': 240, 'Leicester Square': 260, 'Coventry Street': 260, 'Piccadilly': 280, 'Regent Street': 300, 'Oxford Street': 300, 'Bond Street': 320, 'Park Lane': 350, 'Mayfair': 400, 'Kings Cross Station': 200, 'Marylebone Station': 200, 'Fenchurch St Station': 200, 'Liverpool St Station': 200, 'Electric Company': 150, 'Water Works': 150}, houseCosts: {'Old Kent Road': 50, 'Whitechapel Road': 50, 'The Angel Islington': 50, 'Euston Road': 50, 'Pentonville Road': 50, 'Pall Mall': 100, 'Whitehall': 100, 'Northumberland Avenue': 100, 'Bow Street': 100, 'Marlborough Street': 100, 'Vine Street': 100, 'Strand': 150, 'Fleet Street': 150, 'Trafalgar Square': 150, 'Leicester Square': 150, 'Coventry Street': 150, 'Piccadilly': 150, 'Regent Street': 200, 'Oxford Street': 200, 'Bond Street': 200, 'Park Lane': 200, 'Mayfair': 200}};      \n      const calculateNetWorth = (player) => {\n        let net = player.balance || 0;\n        (player.properties || []).forEach(p => {\n          if (propertyData.prices[p.name]) net += propertyData.prices[p.name];\n          net += (p.houses || 0) * (propertyData.houseCosts[p.name] || 0);\n          if (p.mortgaged) net -= Math.floor((propertyData.prices[p.name] || 0) / 2);\n        });\n        return net;\n      };\n      \n      const playerNetWorths = game.players.map(p => ({\n        player: p,\n        netWorth: calculateNetWorth(p),\n        propertiesOwned: p.properties?.length || 0,\n        totalHouses: p.properties?.reduce((h, pr) => h + (pr.houses || 0), 0) || 0,\n        spent: (p.properties || []).reduce((s, pr) => s + (propertyData.prices[pr.name] || 0) + ((pr.houses || 0) * (propertyData.houseCosts[pr.name] || 0)), 0)\n      }));\n      \n      const sortedByNetWorth = playerNetWorths.sort((a, b) => b.netWorth - a.netWorth);\n      const topNetWorth = sortedByNetWorth[0]?.netWorth || 0;\n      \n      for (const pwObj of playerNetWorths) {\n        const playerUser = await User.findById(pwObj.player.user._id || pwObj.player.user);\n        if (playerUser) {\n          playerUser.stats.gamesPlayed = (playerUser.stats.gamesPlayed || 0) + 1;\n          const isWinner = pwObj.netWorth === topNetWorth && topNetWorth > 0;\n          if (isWinner) playerUser.stats.gamesWon = (playerUser.stats.gamesWon || 0) + 1;\n          const earnings = pwObj.player.balance - (game.startingBalance || 1500);\n          playerUser.stats.totalEarnings = (playerUser.stats.totalEarnings || 0) + earnings;\n          playerUser.stats.propertiesOwned = (playerUser.stats.propertiesOwned || 0) + pwObj.propertiesOwned;\n          playerUser.stats.totalHousesBuilt = (playerUser.stats.totalHousesBuilt || 0) + pwObj.totalHouses;\n          playerUser.stats.moneySpent = (playerUser.stats.moneySpent || 0) + pwObj.spent;\n          \n          playerUser.gameHistory.push({\n            gameId: game._id.toString(),\n            date: new Date(),\n            players: game.players.length,\n            result: isWinner ? 'Won' : 'Lost',\n            earnings: earnings,\n            netWorth: pwObj.netWorth,\n            propertiesOwned: pwObj.propertiesOwned,\n            houses: pwObj.totalHouses,\n            edition: 'Deluxe',\n          });\n          \n          await playerUser.save();\n        }\n      }\n    } catch (statsErr) {\n      console.error(\"Error updating player stats:\", statsErr);\n    }

    res.json({
      message: "Game ended",
      game: {
        id: game._id,
        code: game.code,
        name: game.name,
        players: game.players,
        status: game.status,
        finishedAt: game.finishedAt,
        endReason: game.endReason,
      },
    });
  } catch (error) {
    console.error("End game error:", error);
    res.status(500).json({ message: "Error ending game", error: error.message });
  }
});

// @route   POST /api/games/activity
// @desc    Update game activity timestamp
// @access  Private
router.post("/activity", authenticate, async (req, res) => {
  try {
    const { gameId } = req.body;

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const isInGame = game.players.some(
      (p) => p.user.toString() === req.user._id.toString()
    );

    if (!isInGame) {
      return res.status(403).json({ message: "You are not in this game" });
    }

    game.lastActivity = new Date();
    await game.save();

    res.json({ 
      message: "Activity updated",
      lastActivity: game.lastActivity,
    });
  } catch (error) {
    console.error("Update activity error:", error);
    res.status(500).json({ message: "Error updating activity", error: error.message });
  }
});

// @route   GET /api/games/check-idle/:gameId
// @desc    Check if game is idle and handle timeout (30 minutes)
// @access  Private
router.get("/check-idle/:gameId", authenticate, async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId)
      .populate("players.user", "username displayName avatar uid")
      .populate("host", "username displayName avatar uid");

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.status !== "in_progress") {
      return res.json({ 
        isIdle: false, 
        gameEnded: game.status === "finished",
        endReason: game.endReason,
      });
    }

    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    const now = new Date();
    const lastActivity = new Date(game.lastActivity || game.startedAt || game.createdAt);
    const idleTime = now - lastActivity;

    if (idleTime >= IDLE_TIMEOUT_MS) {
      // End the game due to idle timeout
      game.status = "finished";
      game.finishedAt = now;
      game.endReason = "idle_timeout";
      await game.save();

      // Update stats for all players
      try {
        const sortedPlayers = [...game.players].sort((a, b) => b.balance - a.balance);
        const winnerBalance = sortedPlayers[0]?.balance;
        
        for (const player of game.players) {
          const playerUser = await User.findById(player.user._id || player.user);
          if (playerUser) {
            playerUser.stats.gamesPlayed = (playerUser.stats.gamesPlayed || 0) + 1;
            const isWinner = player.balance === winnerBalance && player.balance > 0;
            if (isWinner) {
              playerUser.stats.gamesWon = (playerUser.stats.gamesWon || 0) + 1;
            }
            const earnings = player.balance - (game.startingBalance || 1500);
            playerUser.stats.totalEarnings = (playerUser.stats.totalEarnings || 0) + earnings;
            
            playerUser.gameHistory.push({
              gameId: game._id.toString(),
              date: new Date(),
              players: game.players.length,
              result: isWinner ? 'Won' : 'Lost',
              earnings: earnings,
              edition: 'Deluxe',
            });
            
            await playerUser.save();
          }
        }
      } catch (statsErr) {
        console.error("Error updating player stats on idle:", statsErr);
      }

      return res.json({
        isIdle: true,
        gameEnded: true,
        endReason: "idle_timeout",
        message: "Game ended due to 30 minutes of inactivity",
        game: {
          id: game._id,
          code: game.code,
          name: game.name,
          players: game.players,
        },
      });
    }

    // Calculate remaining time before idle timeout
    const remainingMs = IDLE_TIMEOUT_MS - idleTime;
    const remainingMinutes = Math.floor(remainingMs / 60000);
    const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

    res.json({
      isIdle: false,
      gameEnded: false,
      remainingMs,
      remainingMinutes,
      remainingSeconds,
      lastActivity: game.lastActivity,
    });
  } catch (error) {
    console.error("Check idle error:", error);
    res.status(500).json({ message: "Error checking idle status", error: error.message });
  }
});

// @route   POST /api/games/resume
// @desc    Resume a saved game (creates a new game with same balances)
// @access  Private
router.post("/resume", authenticate, async (req, res) => {
  try {
    const { gameId } = req.body;

    const oldGame = await Game.findById(gameId)
      .populate("players.user", "username displayName avatar uid");

    if (!oldGame) {
      return res.status(404).json({ message: "Saved game not found" });
    }

    if (oldGame.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the original host can resume this game" });
    }

    if (!['idle_timeout', 'host_left', 'saved'].includes(oldGame.endReason)) {
      return res.status(400).json({ message: "This game cannot be resumed" });
    }

    // Check if user already has an active game
    const existingGame = await Game.findOne({
      "players.user": req.user._id,
      status: { $in: ["waiting", "in_progress", "paused"] },
    });

    if (existingGame) {
      return res.status(400).json({ 
        message: "You already have an active game",
        gameCode: existingGame.code,
      });
    }

    // Create new game with same settings but in waiting state
    const newGame = new Game({
      name: `${oldGame.name} (Resumed)`,
      host: req.user._id,
      maxPlayers: oldGame.maxPlayers,
      startingBalance: oldGame.startingBalance,
      goSalary: oldGame.goSalary,
      settings: oldGame.settings,
    });

    // Add only the host as player initially (others will need to rejoin)
    // Preserve the host's balance from the old game
    const hostOldPlayer = oldGame.players.find(
      (p) => p.user._id.toString() === req.user._id.toString()
    );
    
    newGame.players.push({
      user: req.user._id,
      balance: hostOldPlayer?.balance || oldGame.startingBalance,
      color: hostOldPlayer?.color || "red",
      isHost: true,
      isReady: true,
    });

    // Store reference to original game's player balances for rejoining players
    newGame.resumedFrom = oldGame._id;
    newGame.originalPlayerBalances = oldGame.players.map((p) => ({
      user: p.user._id || p.user,
      balance: p.balance,
      color: p.color,
    }));

    await newGame.save();

    // Delete the old saved game
    await Game.findByIdAndDelete(oldGame._id);

    await newGame.populate("players.user", "username displayName avatar uid");
    await newGame.populate("host", "username displayName avatar uid");

    res.json({
      message: "Game resumed successfully",
      game: {
        id: newGame._id,
        code: newGame.code,
        name: newGame.name,
        host: newGame.host,
        players: newGame.players,
        maxPlayers: newGame.maxPlayers,
        startingBalance: newGame.startingBalance,
        goSalary: newGame.goSalary,
        status: newGame.status,
        settings: newGame.settings,
        playerCount: newGame.playerCount,
      },
    });
  } catch (error) {
    console.error("Resume game error:", error);
    res.status(500).json({ message: "Error resuming game", error: error.message });
  }
});

// @route   DELETE /api/games/saved/:gameId
// @desc    Delete a saved game
// @access  Private
router.delete("/saved/:gameId", authenticate, async (req, res) => {
  try {
    const game = await Game.findById(req.params.gameId);

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the host can delete this game" });
    }

    await Game.findByIdAndDelete(req.params.gameId);

    res.json({ message: "Saved game deleted successfully" });
  } catch (error) {
    console.error("Delete saved game error:", error);
    res.status(500).json({ message: "Error deleting saved game", error: error.message });
  }
});

// @route   POST /api/games/property/buy
// @desc    Buy a property (add to player's properties)
// @access  Private
router.post("/property/buy", authenticate, async (req, res) => {
  try {
    const { gameId, propertyName, colorGroup, price } = req.body;

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (game.status !== "in_progress") return res.status(400).json({ message: "Game is not in progress" });

    const player = game.players.find(p => p.user.toString() === req.user._id.toString());
    if (!player) return res.status(400).json({ message: "You are not in this game" });

    // Check if property is already owned
    const alreadyOwned = game.players.some(p => 
      p.properties?.some(prop => prop.name === propertyName)
    );
    if (alreadyOwned) return res.status(400).json({ message: "Property is already owned" });

    if (price && player.balance < price) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    if (price) player.balance -= price;
    player.properties.push({ name: propertyName, colorGroup, houses: 0 });

    game.lastActivity = new Date();
    if (price) {
      game.recordTransaction(req.user._id, null, price, "purchase", `Bought ${propertyName}`);
    }
    await game.save();
    await game.populate("players.user", "username displayName avatar uid");

    res.json({ players: game.players });
  } catch (error) {
    console.error("Buy property error:", error);
    res.status(500).json({ message: "Error buying property", error: error.message });
  }
});

// @route   POST /api/games/property/sell
// @desc    Sell a property (remove from player's properties)
// @access  Private
router.post("/property/sell", authenticate, async (req, res) => {
  try {
    const { gameId, propertyName, price } = req.body;

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (game.status !== "in_progress") return res.status(400).json({ message: "Game is not in progress" });

    const player = game.players.find(p => p.user.toString() === req.user._id.toString());
    if (!player) return res.status(400).json({ message: "You are not in this game" });

    const propIndex = player.properties.findIndex(prop => prop.name === propertyName);
    if (propIndex === -1) return res.status(400).json({ message: "You don't own this property" });

    if (price) player.balance += price;
    player.properties.splice(propIndex, 1);

    game.lastActivity = new Date();
    await game.save();
    await game.populate("players.user", "username displayName avatar uid");

    res.json({ players: game.players });
  } catch (error) {
    console.error("Sell property error:", error);
    res.status(500).json({ message: "Error selling property", error: error.message });
  }
});

// @route   POST /api/games/property/house
// @desc    Add/remove house on a property
// @access  Private
router.post("/property/house", authenticate, async (req, res) => {
  try {
    const { gameId, propertyName, action, cost } = req.body;

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (game.status !== "in_progress") return res.status(400).json({ message: "Game is not in progress" });

    const player = game.players.find(p => p.user.toString() === req.user._id.toString());
    if (!player) return res.status(400).json({ message: "You are not in this game" });

    const property = player.properties.find(prop => prop.name === propertyName);
    if (!property) return res.status(400).json({ message: "You don't own this property" });

    if (action === "add") {
      if (property.houses >= 5) return res.status(400).json({ message: "Maximum houses reached (hotel)" });
      if (cost && player.balance < cost) return res.status(400).json({ message: "Insufficient balance" });
      property.houses += 1;
      if (cost) player.balance -= cost;
      game.recordTransaction(req.user._id, null, cost || 0, "house_purchase", `Bought house on ${propertyName}`);
    } else if (action === "remove") {
      if (property.houses <= 0) return res.status(400).json({ message: "No houses to remove" });
      property.houses -= 1;
      if (cost) player.balance += Math.floor((cost || 0) * 0.5);
      game.recordTransaction(req.user._id, null, Math.floor((cost || 0) * 0.5), "house_sale", `Sold house on ${propertyName}`);
    }

    game.lastActivity = new Date();
    game.markModified('players');
    await game.save();
    await game.populate("players.user", "username displayName avatar uid");

    res.json({ players: game.players });
  } catch (error) {
    console.error("House operation error:", error);
    res.status(500).json({ message: "Error with house operation", error: error.message });
  }
});

// @route   POST /api/games/property/mortgage
// @desc    Mortgage or unmortgage a property
// @access  Private
router.post("/property/mortgage", authenticate, async (req, res) => {
  try {
    const { gameId, propertyName, action, value } = req.body;

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (game.status !== "in_progress") return res.status(400).json({ message: "Game is not in progress" });

    const player = game.players.find(p => p.user.toString() === req.user._id.toString());
    if (!player) return res.status(400).json({ message: "You are not in this game" });

    const property = player.properties.find(p => p.name === propertyName);
    if (!property) return res.status(400).json({ message: "You don't own this property" });

    if (action === "mortgage") {
      if (property.mortgaged) return res.status(400).json({ message: "Property is already mortgaged" });
      if (property.houses > 0) return res.status(400).json({ message: "Sell all houses before mortgaging" });
      property.mortgaged = true;
      if (value) player.balance += value;
      game.recordTransaction(req.user._id, null, value || 0, "mortgage", `Mortgaged ${propertyName}`);
    } else if (action === "unmortgage") {
      if (!property.mortgaged) return res.status(400).json({ message: "Property is not mortgaged" });
      if (value && player.balance < value) return res.status(400).json({ message: "Insufficient balance to unmortgage" });
      property.mortgaged = false;
      if (value) player.balance -= value;
      game.recordTransaction(req.user._id, null, value || 0, "unmortgage", `Unmortgaged ${propertyName}`);
    }

    game.lastActivity = new Date();
    game.markModified('players');
    await game.save();
    await game.populate("players.user", "username displayName avatar uid");

    res.json({ players: game.players });
  } catch (error) {
    console.error("Mortgage operation error:", error);
    res.status(500).json({ message: "Error with mortgage operation", error: error.message });
  }
});

export default router;
