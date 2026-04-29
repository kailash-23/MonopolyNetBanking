import express from "express";
import mongoose from "mongoose";
import Game from "../models/Game.js";
import User from "../models/User.js";
import { verifyAuthToken } from "../middleware/verifyAuthToken.js";

const router = express.Router();

const PROPERTY_CATALOG = [
  { name: "Old Kent Road", colorGroup: "brown", price: 60, houseCost: 50 },
  { name: "Whitechapel Road", colorGroup: "brown", price: 60, houseCost: 50 },
  { name: "The Angel Islington", colorGroup: "lightblue", price: 100, houseCost: 50 },
  { name: "Euston Road", colorGroup: "lightblue", price: 100, houseCost: 50 },
  { name: "Pentonville Road", colorGroup: "lightblue", price: 120, houseCost: 50 },
  { name: "Pall Mall", colorGroup: "pink", price: 140, houseCost: 100 },
  { name: "Whitehall", colorGroup: "pink", price: 140, houseCost: 100 },
  { name: "Northumberland Avenue", colorGroup: "pink", price: 160, houseCost: 100 },
  { name: "Bow Street", colorGroup: "orange", price: 180, houseCost: 100 },
  { name: "Marlborough Street", colorGroup: "orange", price: 180, houseCost: 100 },
  { name: "Vine Street", colorGroup: "orange", price: 200, houseCost: 100 },
  { name: "Strand", colorGroup: "red", price: 220, houseCost: 150 },
  { name: "Fleet Street", colorGroup: "red", price: 220, houseCost: 150 },
  { name: "Trafalgar Square", colorGroup: "red", price: 240, houseCost: 150 },
  { name: "Leicester Square", colorGroup: "yellow", price: 260, houseCost: 150 },
  { name: "Coventry Street", colorGroup: "yellow", price: 260, houseCost: 150 },
  { name: "Piccadilly", colorGroup: "yellow", price: 280, houseCost: 150 },
  { name: "Regent Street", colorGroup: "green", price: 300, houseCost: 200 },
  { name: "Oxford Street", colorGroup: "green", price: 300, houseCost: 200 },
  { name: "Bond Street", colorGroup: "green", price: 320, houseCost: 200 },
  { name: "Park Lane", colorGroup: "darkblue", price: 350, houseCost: 200 },
  { name: "Mayfair", colorGroup: "darkblue", price: 400, houseCost: 200 },
  { name: "Kings Cross Station", colorGroup: "station", price: 200, houseCost: 0 },
  { name: "Marylebone Station", colorGroup: "station", price: 200, houseCost: 0 },
  { name: "Fenchurch St Station", colorGroup: "station", price: 200, houseCost: 0 },
  { name: "Liverpool St Station", colorGroup: "station", price: 200, houseCost: 0 },
  { name: "Electric Company", colorGroup: "utility", price: 150, houseCost: 0 },
  { name: "Water Works", colorGroup: "utility", price: 150, houseCost: 0 },
];

const BOARD_ORDER = PROPERTY_CATALOG.map((property) => property.name);
const STATION_BOARD_POSITIONS = [5, 15, 25, 35];
const STATION_RENTS = [25, 50, 100, 200];

const PROPERTY_BY_NAME = new Map(PROPERTY_CATALOG.map((property) => [property.name, property]));

const canDevelopColorGroup = (colorGroup) => !["station", "utility"].includes(colorGroup);

const hasFullColorSet = (playerProperties, colorGroup) => {
  const groupProps = PROPERTY_CATALOG.filter((property) => property.colorGroup === colorGroup);
  if (!groupProps.length) {
    return false;
  }
  return groupProps.every((property) => playerProperties.some((owned) => owned.name === property.name));
};

const getNearestStationRent = (boardPosition, stationCount) => {
  if (!stationCount) {
    return 0;
  }

  const normalizedPosition = ((boardPosition % BOARD_ORDER.length) + BOARD_ORDER.length) % BOARD_ORDER.length;
  let nearestDistance = Infinity;

  STATION_BOARD_POSITIONS.forEach((stationPosition, index) => {
    const forwardDistance = (stationPosition - normalizedPosition + BOARD_ORDER.length) % BOARD_ORDER.length;
    const backwardDistance = (normalizedPosition - stationPosition + BOARD_ORDER.length) % BOARD_ORDER.length;
    const distance = Math.min(forwardDistance, backwardDistance);

    if (distance < nearestDistance) {
      nearestDistance = distance;
    }
  });

  return STATION_RENTS[Math.max(0, Math.min(stationCount, 4)) - 1] || STATION_RENTS[0];
};

const getStationOwner = (game, boardPosition) => {
  const nearestStationIndex = STATION_BOARD_POSITIONS.reduce((closestIndex, stationPosition, index) => {
    const closestPosition = STATION_BOARD_POSITIONS[closestIndex];
    const normalizedPosition = ((boardPosition % BOARD_ORDER.length) + BOARD_ORDER.length) % BOARD_ORDER.length;
    const currentDistance = Math.min(
      (stationPosition - normalizedPosition + BOARD_ORDER.length) % BOARD_ORDER.length,
      (normalizedPosition - stationPosition + BOARD_ORDER.length) % BOARD_ORDER.length,
    );
    const closestDistance = Math.min(
      (closestPosition - normalizedPosition + BOARD_ORDER.length) % BOARD_ORDER.length,
      (normalizedPosition - closestPosition + BOARD_ORDER.length) % BOARD_ORDER.length,
    );
    return currentDistance < closestDistance ? index : closestIndex;
  }, 0);

  const nearestStationName = BOARD_ORDER[STATION_BOARD_POSITIONS[nearestStationIndex]];
  const owner = game.players.find((player) =>
    (player.properties || []).some((property) => property.name === nearestStationName)
  );

  return {
    owner,
    nearestStationName,
    nearestStationIndex,
  };
};

const isTransientTransactionError = (error) => {
  const transientCodes = new Set([112, 244, 251]);
  return Boolean(error?.errorLabels?.includes("TransientTransactionError") || transientCodes.has(error?.code));
};

// @route   POST /api/games/create
// @desc    Create a new game session
// @access  Private
router.post("/create", verifyAuthToken, async (req, res) => {
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
router.post("/join", verifyAuthToken, async (req, res) => {
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
router.post("/leave", verifyAuthToken, async (req, res) => {
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
router.get("/saved", verifyAuthToken, async (req, res) => {
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
router.get("/:code([A-Za-z0-9]{6})", verifyAuthToken, async (req, res) => {
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
router.get("/my/active", verifyAuthToken, async (req, res) => {
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
router.post("/ready", verifyAuthToken, async (req, res) => {
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
router.post("/select-token", verifyAuthToken, async (req, res) => {
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
router.put("/settings", verifyAuthToken, async (req, res) => {
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
router.post("/start", verifyAuthToken, async (req, res) => {
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
router.post("/transfer", verifyAuthToken, async (req, res) => {
  const { gameId, toPlayerId, amount, type, description } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  const MAX_RETRIES = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let responsePayload = null;
      await session.withTransaction(async () => {
        const game = await Game.findById(gameId).session(session);
        if (!game) {
          throw new Error("GAME_NOT_FOUND");
        }
        if (game.status !== "in_progress") {
          throw new Error("GAME_NOT_IN_PROGRESS");
        }

        const fromPlayer = game.players.find((player) => player.user.toString() === req.user._id.toString());
        if (!fromPlayer) {
          throw new Error("PLAYER_NOT_IN_GAME");
        }

        let toPlayer = null;
        if (type === "transfer" || type === "rent") {
          if (!toPlayerId) {
            throw new Error("RECIPIENT_REQUIRED");
          }
          toPlayer = game.players.find((player) => player.user.toString() === toPlayerId);
          if (!toPlayer) {
            throw new Error("RECIPIENT_NOT_FOUND");
          }
          if (fromPlayer.balance < amount) {
            throw new Error("INSUFFICIENT_BALANCE");
          }
          fromPlayer.balance -= amount;
          toPlayer.balance += amount;
        } else if (["bank_pay", "tax", "purchase"].includes(type)) {
          if (fromPlayer.balance < amount) {
            throw new Error("INSUFFICIENT_BALANCE");
          }
          fromPlayer.balance -= amount;
        } else if (["bank_receive", "go_salary"].includes(type)) {
          fromPlayer.balance += amount;
        }

        game.recordTransaction(req.user._id, toPlayer ? toPlayer.user : null, amount, type, description);
        game.lastActivity = new Date();
        await game.save({ session });
        await game.populate("players.user", "username displayName avatar uid");

        responsePayload = {
          message: "Transaction successful",
          players: game.players,
          transaction: game.transactions[game.transactions.length - 1],
        };
      });

      session.endSession();
      return res.json(responsePayload);
    } catch (error) {
      session.endSession();
      lastError = error;

      if (error.message === "GAME_NOT_FOUND") {
        return res.status(404).json({ message: "Game not found" });
      }
      if (error.message === "GAME_NOT_IN_PROGRESS") {
        return res.status(400).json({ message: "Game is not in progress" });
      }
      if (error.message === "PLAYER_NOT_IN_GAME") {
        return res.status(400).json({ message: "You are not in this game" });
      }
      if (error.message === "RECIPIENT_REQUIRED") {
        return res.status(400).json({ message: "Recipient is required" });
      }
      if (error.message === "RECIPIENT_NOT_FOUND") {
        return res.status(400).json({ message: "Recipient not found in game" });
      }
      if (error.message === "INSUFFICIENT_BALANCE") {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      if (attempt < MAX_RETRIES && isTransientTransactionError(error)) {
        continue;
      }
      break;
    }
  }

  console.error("Transfer error:", lastError);
  res.status(500).json({ message: "Error processing transfer", error: lastError?.message || "Unknown error" });
});

// @route   POST /api/games/request-go
// @desc    Request GO salary (requires approval from host or another player if requester is host)
// @access  Private
router.post("/request-go", verifyAuthToken, async (req, res) => {
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
router.post("/request-bank-receive", verifyAuthToken, async (req, res) => {
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

// @route   POST /api/games/request-property-trade
// @desc    Request selling a property to another player (requires buyer approval)
// @access  Private
router.post("/request-property-trade", verifyAuthToken, async (req, res) => {
  try {
    const { gameId, propertyName, targetPlayerId, amount } = req.body;

    if (!propertyName || !targetPlayerId || !amount || amount <= 0) {
      return res.status(400).json({ message: "Property, target player, and valid amount are required" });
    }

    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.status !== "in_progress") {
      return res.status(400).json({ message: "Game is not in progress" });
    }

    const seller = game.players.find((p) => p.user.toString() === req.user._id.toString());
    if (!seller) {
      return res.status(400).json({ message: "You are not in this game" });
    }

    const buyer = game.players.find((p) => p.user.toString() === targetPlayerId.toString());
    if (!buyer) {
      return res.status(400).json({ message: "Target player is not in this game" });
    }

    if (buyer.user.toString() === seller.user.toString()) {
      return res.status(400).json({ message: "You cannot sell a property to yourself" });
    }

    const property = seller.properties.find((ownedProperty) => ownedProperty.name === propertyName);
    if (!property) {
      return res.status(400).json({ message: "You do not own this property" });
    }

    if (property.houses > 0) {
      return res.status(400).json({ message: "Sell houses/hotel before trading this property" });
    }

    if (property.mortgaged) {
      return res.status(400).json({ message: "Unmortgage this property before trading" });
    }

    game.pendingApprovals.push({
      player: req.user._id,
      approver: buyer.user,
      type: "property_trade",
      amount,
      description: `Property trade: ${propertyName} for £${amount}`,
      propertyName,
      colorGroup: property.colorGroup,
      targetPlayer: buyer.user,
      requestedAt: new Date(),
      status: "pending",
    });

    game.lastActivity = new Date();
    await game.save();

    await game.populate("pendingApprovals.player", "username displayName avatar uid");
    await game.populate("pendingApprovals.approver", "username displayName avatar uid");
    await game.populate("players.user", "username displayName avatar uid");

    res.json({
      message: "Property trade request sent for approval",
      pendingApprovals: game.pendingApprovals.filter((request) => request.status === "pending"),
      players: game.players,
    });
  } catch (error) {
    console.error("Request property trade error:", error);
    res.status(500).json({ message: "Error requesting property trade", error: error.message });
  }
});

// @route   POST /api/games/approve-request
// @desc    Approve or deny a pending approval request
// @access  Private
router.post("/approve-request", verifyAuthToken, async (req, res) => {
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

    // If approved, process the request
    if (approved) {
      if (request.type === "property_trade") {
        const seller = game.players.find((p) => p.user.toString() === request.player.toString());
        const buyer = game.players.find((p) => p.user.toString() === request.approver.toString());

        if (!seller || !buyer) {
          return res.status(400).json({ message: "Seller or buyer is no longer in the game" });
        }

        const soldPropertyIndex = seller.properties.findIndex(
          (ownedProperty) => ownedProperty.name === request.propertyName
        );

        if (soldPropertyIndex === -1) {
          return res.status(400).json({ message: "Property is no longer owned by the seller" });
        }

        const soldProperty = seller.properties[soldPropertyIndex];
        if (soldProperty.houses > 0 || soldProperty.mortgaged) {
          return res.status(400).json({
            message: "Property must be free of houses/hotel and not mortgaged to complete trade",
          });
        }

        if (buyer.balance < request.amount) {
          return res.status(400).json({ message: "Buyer has insufficient funds" });
        }

        buyer.balance -= request.amount;
        seller.balance += request.amount;

        const [movedProperty] = seller.properties.splice(soldPropertyIndex, 1);
        buyer.properties.push(movedProperty);

        game.recordTransaction(
          buyer.user,
          seller.user,
          request.amount,
          "property_trade",
          `Property trade: ${request.propertyName} for £${request.amount}`
        );
      } else {
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
    }

    // Update activity timestamp
    game.lastActivity = new Date();
    await game.save();

    await game.populate("pendingApprovals.player", "username displayName avatar uid");
    await game.populate("pendingApprovals.approver", "username displayName avatar uid");
    await game.populate("players.user", "username displayName avatar uid");

    const typeLabel = request.type === "go_salary"
      ? "GO salary"
      : request.type === "bank_receive"
      ? "Bank receive"
      : "Property trade";
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
router.post("/save", verifyAuthToken, async (req, res) => {
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
router.post("/end", verifyAuthToken, async (req, res) => {
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
      const propertyPrices = {
        'Old Kent Road': 60, 'Whitechapel Road': 60, 'The Angel Islington': 100,
        'Euston Road': 100, 'Pentonville Road': 120, 'Pall Mall': 140, 'Whitehall': 140,
        'Northumberland Avenue': 160, 'Bow Street': 180, 'Marlborough Street': 180,
        'Vine Street': 200, 'Strand': 220, 'Fleet Street': 220, 'Trafalgar Square': 240,
        'Leicester Square': 260, 'Coventry Street': 260, 'Piccadilly': 280,
        'Regent Street': 300, 'Oxford Street': 300, 'Bond Street': 320,
        'Park Lane': 350, 'Mayfair': 400, 'Kings Cross Station': 200,
        'Marylebone Station': 200, 'Fenchurch St Station': 200, 'Liverpool St Station': 200,
        'Electric Company': 150, 'Water Works': 150,
      };
      const houseCosts = {
        'Old Kent Road': 50, 'Whitechapel Road': 50, 'The Angel Islington': 50,
        'Euston Road': 50, 'Pentonville Road': 50, 'Pall Mall': 100, 'Whitehall': 100,
        'Northumberland Avenue': 100, 'Bow Street': 100, 'Marlborough Street': 100,
        'Vine Street': 100, 'Strand': 150, 'Fleet Street': 150, 'Trafalgar Square': 150,
        'Leicester Square': 150, 'Coventry Street': 150, 'Piccadilly': 150,
        'Regent Street': 200, 'Oxford Street': 200, 'Bond Street': 200,
        'Park Lane': 200, 'Mayfair': 200,
      };

      const calculateNetWorth = (player) => {
        let net = player.balance || 0;
        (player.properties || []).forEach((prop) => {
          net += propertyPrices[prop.name] || 0;
          net += (prop.houses || 0) * (houseCosts[prop.name] || 0);
          if (prop.mortgaged) {
            net -= Math.floor((propertyPrices[prop.name] || 0) / 2);
          }
        });
        return net;
      };

      const playerNetWorths = game.players.map((player) => ({
        player,
        netWorth: calculateNetWorth(player),
        propertiesOwned: player.properties?.length || 0,
        totalHouses: player.properties?.reduce((sum, prop) => sum + (prop.houses || 0), 0) || 0,
        spent: (player.properties || []).reduce(
          (sum, prop) => sum + (propertyPrices[prop.name] || 0) + ((prop.houses || 0) * (houseCosts[prop.name] || 0)),
          0
        ),
      }));

      const topNetWorth = playerNetWorths.reduce((max, item) => Math.max(max, item.netWorth), 0);

      for (const item of playerNetWorths) {
        const playerUser = await User.findById(item.player.user._id || item.player.user);
        if (!playerUser) continue;

        playerUser.stats.gamesPlayed = (playerUser.stats.gamesPlayed || 0) + 1;
        const isWinner = item.netWorth === topNetWorth && topNetWorth > 0;
        if (isWinner) {
          playerUser.stats.gamesWon = (playerUser.stats.gamesWon || 0) + 1;
        }

        const earnings = item.player.balance - (game.startingBalance || 1500);
        playerUser.stats.totalEarnings = (playerUser.stats.totalEarnings || 0) + earnings;
        playerUser.stats.propertiesOwned = (playerUser.stats.propertiesOwned || 0) + item.propertiesOwned;
        playerUser.stats.totalHousesBuilt = (playerUser.stats.totalHousesBuilt || 0) + item.totalHouses;
        playerUser.stats.moneySpent = (playerUser.stats.moneySpent || 0) + item.spent;

        playerUser.gameHistory.push({
          gameId: game._id.toString(),
          date: new Date(),
          players: game.players.length,
          result: isWinner ? 'Won' : 'Lost',
          earnings,
          netWorth: item.netWorth,
          propertiesOwned: item.propertiesOwned,
          houses: item.totalHouses,
          edition: 'Deluxe',
        });

        await playerUser.save();
      }
    } catch (statsErr) {
      console.error('Error updating player stats:', statsErr);
    }

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
router.post("/activity", verifyAuthToken, async (req, res) => {
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
router.get("/check-idle/:gameId", verifyAuthToken, async (req, res) => {
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
router.post("/resume", verifyAuthToken, async (req, res) => {
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
router.delete("/saved/:gameId", verifyAuthToken, async (req, res) => {
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
router.post("/property/buy", verifyAuthToken, async (req, res) => {
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
      game.recordTransaction(req.user._id, null, price, "purchase", `Bought ${propertyName} for £${price}`);
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
router.post("/property/sell", verifyAuthToken, async (req, res) => {
  try {
    const { gameId, propertyName } = req.body;

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (game.status !== "in_progress") return res.status(400).json({ message: "Game is not in progress" });

    const player = game.players.find(p => p.user.toString() === req.user._id.toString());
    if (!player) return res.status(400).json({ message: "You are not in this game" });

    const property = player.properties.find((ownedProperty) => ownedProperty.name === propertyName);
    if (!property) return res.status(400).json({ message: "You don't own this property" });

    if (property.houses > 0) {
      return res.status(400).json({
        message: "Sell houses/hotel on this property before listing it for sale",
      });
    }

    res.status(400).json({
      message: "Direct bank selling is disabled. Use property trade requests instead.",
    });
  } catch (error) {
    console.error("Sell property error:", error);
    res.status(500).json({ message: "Error selling property", error: error.message });
  }
});

// @route   POST /api/games/property/house
// @desc    Add/remove house on a property
// @access  Private
router.post("/property/house", verifyAuthToken, async (req, res) => {
  try {
    const { gameId, propertyName, action, cost } = req.body;

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: "Game not found" });
    if (game.status !== "in_progress") return res.status(400).json({ message: "Game is not in progress" });

    const player = game.players.find(p => p.user.toString() === req.user._id.toString());
    if (!player) return res.status(400).json({ message: "You are not in this game" });

    const property = player.properties.find(prop => prop.name === propertyName);
    if (!property) return res.status(400).json({ message: "You don't own this property" });

    if (property.mortgaged) {
      return res.status(400).json({ message: "Unmortgage the property before adding or removing houses" });
    }

    const propertyCatalogEntry = PROPERTY_BY_NAME.get(propertyName);
    const developmentCost = cost || propertyCatalogEntry?.houseCost || 0;
    const ownsFullSet = hasFullColorSet(player.properties, property.colorGroup);

    if (action === "add") {
      if (!canDevelopColorGroup(property.colorGroup)) {
        return res.status(400).json({ message: "Houses and hotels are only available on color-set properties" });
      }
      if (!ownsFullSet) {
        return res.status(400).json({ message: "You must own the full color group before building houses" });
      }
      if (property.houses >= 5) {
        return res.status(400).json({ message: "Hotel already built on this property" });
      }
      if (developmentCost > 0 && player.balance < developmentCost) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      property.houses += 1;
      if (developmentCost > 0) {
        player.balance -= developmentCost;
      }

      const structureLabel = property.houses === 5 ? "hotel" : "house";
      game.recordTransaction(
        req.user._id,
        null,
        developmentCost,
        "purchase",
        `Built ${structureLabel} on ${propertyName} for £${developmentCost}`
      );
    } else if (action === "remove") {
      if (property.houses <= 0) return res.status(400).json({ message: "No houses to remove" });

      property.houses -= 1;
      const refundAmount = Math.floor(developmentCost * 0.5);
      if (refundAmount > 0) {
        player.balance += refundAmount;
      }
      game.recordTransaction(
        null,
        req.user._id,
        refundAmount,
        "bank_receive",
        `Sold ${property.houses >= 4 ? "hotel" : "house"} on ${propertyName} for £${refundAmount}`
      );
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
router.post("/property/mortgage", verifyAuthToken, async (req, res) => {
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
      game.recordTransaction(req.user._id, null, value || 0, "unmortgage", `Unmortgaged ${propertyName} with 10% interest`);
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

// @route   POST /api/games/auction/start
// @desc    Start an auction for a property (blind auctions supported)
// @access  Private
router.post('/auction/start', verifyAuthToken, async (req, res) => {
  try {
    const { gameId, propertyName, blind } = req.body;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (game.status !== 'in_progress') return res.status(400).json({ message: 'Game is not in progress' });

    // Ensure property isn't already owned
    const alreadyOwned = game.players.some(p => p.properties?.some(prop => prop.name === propertyName));
    if (alreadyOwned) return res.status(400).json({ message: 'Property is already owned' });

    if (game.currentAuction && game.currentAuction.startedAt && !game.currentAuction.resolved) {
      return res.status(400).json({ message: 'Another auction is already in progress' });
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + 60 * 1000); // 1 minute

    game.currentAuction = {
      propertyName,
      startedBy: req.user._id,
      blind: (blind === true) || (game.settings && game.settings.creativeMode === true),
      bids: [],
      startedAt: now,
      endsAt,
      resolved: false,
    };

    game.lastActivity = now;
    await game.save();
    await game.populate('players.user', 'username displayName avatar uid');

    res.json({ message: 'Auction started', currentAuction: { propertyName, startedAt: now, endsAt, blind: game.currentAuction.blind } });
  } catch (error) {
    console.error('Start auction error:', error);
    res.status(500).json({ message: 'Error starting auction', error: error.message });
  }
});

// @route   POST /api/games/auction/bid
// @desc    Place a bid on the current auction (no balance changes until resolution)
// @access  Private
router.post('/auction/bid', verifyAuthToken, async (req, res) => {
  try {
    const { gameId, amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid bid amount' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (!game.currentAuction || !game.currentAuction.startedAt || game.currentAuction.resolved) return res.status(400).json({ message: 'No active auction' });

    const now = new Date();
    if (new Date(game.currentAuction.endsAt) <= now) return res.status(400).json({ message: 'Auction has ended' });

    // Record bid (blind auctions: stored server-side)
    game.currentAuction.bids.push({ player: req.user._id, amount, placedAt: now });
    game.lastActivity = now;
    await game.save();

    // Return only bid count when blind
    const response = { message: 'Bid placed', bidsCount: game.currentAuction.bids.length };
    res.json(response);
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({ message: 'Error placing bid', error: error.message });
  }
});

// @route   POST /api/games/auction/end
// @desc    End the active auction early (host or auction starter)
// @access  Private
router.post('/auction/end', verifyAuthToken, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (!game.currentAuction || !game.currentAuction.startedAt || game.currentAuction.resolved) return res.status(400).json({ message: 'No active auction' });

    const isHost = String(game.host) === String(req.user._id);
    const isStarter = String(game.currentAuction.startedBy) === String(req.user._id);
    if (!isHost && !isStarter) return res.status(403).json({ message: 'Only host or auction starter can end the auction early' });

    // Set endsAt to now so next fetch will resolve it
    game.currentAuction.endsAt = new Date();
    game.lastActivity = new Date();
    await game.save();

    res.json({ message: 'Auction will be resolved shortly' });
  } catch (error) {
    console.error('End auction error:', error);
    res.status(500).json({ message: 'Error ending auction', error: error.message });
  }
});

// @route   POST /api/games/tax
// @desc    Charge a player tax based on owned properties, houses and hotels
// @access  Private
router.post('/tax', verifyAuthToken, async (req, res) => {
  try {
    const { gameId, playerId } = req.body;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (game.status !== 'in_progress') return res.status(400).json({ message: 'Game is not in progress' });

    const player = game.players.find(p => String(p.user._id || p.user) === String(playerId || req.user._id));
    if (!player) return res.status(400).json({ message: 'Player not found in game' });

    // Tax rules (configurable later): £20 per property, £25 per house, £100 per hotel (hotel = 5 houses)
    const perProperty = 20;
    const perHouse = 25;
    const perHotel = 100;

    let propertiesCount = (player.properties || []).length;
    let housesCount = 0;
    let hotelsCount = 0;
    (player.properties || []).forEach(prop => {
      if (prop.houses >= 5) hotelsCount += 1;
      else housesCount += (prop.houses || 0);
    });

    const taxAmount = (propertiesCount * perProperty) + (housesCount * perHouse) + (hotelsCount * perHotel);

    if (taxAmount > 0) {
      if ((player.balance || 0) < taxAmount) return res.status(400).json({ message: 'Player has insufficient funds to pay tax' });
      player.balance -= taxAmount;
      game.recordTransaction(player.user, null, taxAmount, 'tax', `Property tax: ${propertiesCount} properties, ${housesCount} houses, ${hotelsCount} hotels`);
      game.lastActivity = new Date();
      await game.save();
    }

    await game.populate('players.user', 'username displayName avatar uid');
    res.json({ message: 'Tax applied', taxAmount, players: game.players });
  } catch (error) {
    console.error('Tax error:', error);
    res.status(500).json({ message: 'Error applying tax', error: error.message });
  }
});

// @route   POST /api/games/utility/pay
// @desc    Pay utility rent based on dice roll and number of utilities owned
// @access  Private
router.post('/utility/pay', verifyAuthToken, async (req, res) => {
  try {
    const { gameId, landingPlayerId, propertyName, diceRoll } = req.body;
    if (!diceRoll || diceRoll <= 0) return res.status(400).json({ message: 'Invalid dice roll' });

    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (game.status !== 'in_progress') return res.status(400).json({ message: 'Game is not in progress' });

    const owner = game.players.find(p => p.properties?.some(prop => prop.name === propertyName));
    if (!owner) return res.status(400).json({ message: 'Utility has no owner' });

    // Determine number of utilities owned by owner
    const utilityCount = (owner.properties || []).filter(prop => prop.colorGroup === 'utility').length;
    const multiplier = utilityCount === 2 ? 10 : 4;
    const amount = multiplier * diceRoll;

    const payer = game.players.find(p => String(p.user._id || p.user) === String(landingPlayerId || req.user._id));
    if (!payer) return res.status(400).json({ message: 'Landing player not found in game' });
    if ((payer.balance || 0) < amount) return res.status(400).json({ message: 'Payer has insufficient funds' });

    payer.balance -= amount;
    owner.balance += amount;
    game.recordTransaction(payer.user, owner.user, amount, 'rent', `Utility rent for ${propertyName} (dice ${diceRoll} x ${multiplier})`);
    game.lastActivity = new Date();
    await game.save();

    await game.populate('players.user', 'username displayName avatar uid');
    res.json({ message: 'Utility rent paid', amount, players: game.players });
  } catch (error) {
    console.error('Utility pay error:', error);
    res.status(500).json({ message: 'Error processing utility payment', error: error.message });
  }
});

// @route   POST /api/games/jump
// @desc    Jump a random 1-6 spaces and pay the nearest station owner
// @access  Private
router.post('/jump', verifyAuthToken, async (req, res) => {
  try {
    const { gameId } = req.body;
    const game = await Game.findById(gameId);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    if (game.status !== 'in_progress') return res.status(400).json({ message: 'Game is not in progress' });

    const player = game.players.find((p) => String(p.user._id || p.user) === String(req.user._id));
    if (!player) return res.status(400).json({ message: 'You are not in this game' });

    const currentPosition = Number.isInteger(player.boardPosition) ? player.boardPosition : 0;
    const jumpDistance = Math.floor(Math.random() * 6) + 1;
    const newPosition = (currentPosition + jumpDistance) % BOARD_ORDER.length;
    const landedPropertyName = BOARD_ORDER[newPosition];
    const landedProperty = PROPERTY_BY_NAME.get(landedPropertyName);
    const passedGo = currentPosition + jumpDistance >= BOARD_ORDER.length;
    const jumpFee = jumpDistance * 10;

    if ((player.balance || 0) < jumpFee) {
      return res.status(400).json({ message: 'Insufficient balance to jump' });
    }

    player.balance -= jumpFee;
    game.recordTransaction(
      player.user,
      null,
      jumpFee,
      'bank_pay',
      `Jumped ${jumpDistance} spaces for a distance fee of £${jumpFee}${passedGo ? ' without collecting GO salary' : ''}`
    );

    const stationOwnerInfo = getStationOwner(game, newPosition);
    const stationCount = stationOwnerInfo.owner
      ? (stationOwnerInfo.owner.properties || []).filter((property) => property.colorGroup === 'station').length
      : 0;
    const rentAmount = stationOwnerInfo.owner ? getNearestStationRent(newPosition, stationCount) : 0;

    if (stationOwnerInfo.owner && rentAmount > 0) {
      if ((player.balance || 0) < rentAmount) {
        return res.status(400).json({ message: 'Insufficient balance to jump' });
      }

      player.balance -= rentAmount;
      stationOwnerInfo.owner.balance += rentAmount;
      game.recordTransaction(
        player.user,
        stationOwnerInfo.owner.user,
        rentAmount,
        'rent',
        `Jumped ${jumpDistance} spaces to ${landedPropertyName} and paid station rent to the nearest station owner`
      );
    } else {
      game.recordTransaction(
        player.user,
        null,
        0,
        'bank_pay',
        `Jumped ${jumpDistance} spaces to ${landedPropertyName} with no station owner charge${passedGo ? ' and no GO salary was awarded' : ''}`
      );
    }

    player.boardPosition = newPosition;
    game.lastActivity = new Date();
    game.markModified('players');
    await game.save();
    await game.populate('players.user', 'username displayName avatar uid');

    res.json({
      message: 'Jump completed',
      jumpDistance,
      jumpFee,
      passedGo,
      landedProperty: {
        name: landedPropertyName,
        colorGroup: landedProperty?.colorGroup || 'unknown',
      },
      stationRent: rentAmount,
      players: game.players,
    });
  } catch (error) {
    console.error('Jump error:', error);
    res.status(500).json({ message: 'Error processing jump', error: error.message });
  }
});

export default router;
