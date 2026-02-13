import mongoose from "mongoose";
import crypto from "crypto";

// Generate unique 6-digit game code
const generateGameCode = () => {
  // Generate a random 6-digit alphanumeric code (uppercase)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars like 0,O,1,I
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const playerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  balance: {
    type: Number,
    default: 1500,
  },
  color: {
    type: String,
    enum: ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"],
  },
  token: {
    type: String,
    enum: ["dog", "car", "hat", "iron", "boot", "battleship", "wheelbarrow", "thimble", "horse", "train", "cannon"],
    default: null,
  },
  isReady: {
    type: Boolean,
    default: false,
  },
  isHost: {
    type: Boolean,
    default: false,
  },
  properties: [{
    name: { type: String, required: true },
    colorGroup: { type: String, required: true },
    houses: { type: Number, default: 0, min: 0, max: 5 },
    mortgaged: { type: Boolean, default: false },
  }],
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const transactionSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ["transfer", "bank_pay", "bank_receive", "go_salary", "tax", "rent", "purchase"],
    required: true,
  },
  description: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const pendingApprovalSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  approver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  type: {
    type: String,
    enum: ["go_salary", "bank_receive"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "denied"],
    default: "pending",
  },
});

const gameSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      uppercase: true,
      length: 6,
    },
    name: {
      type: String,
      required: [true, "Game name is required"],
      trim: true,
      maxlength: [30, "Game name must be 30 characters or less"],
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    players: [playerSchema],
    maxPlayers: {
      type: Number,
      default: 8,
      min: 2,
      max: 8,
    },
    startingBalance: {
      type: Number,
      default: 1500,
    },
    goSalary: {
      type: Number,
      default: 200,
    },
    status: {
      type: String,
      enum: ["waiting", "in_progress", "paused", "finished"],
      default: "waiting",
    },
    transactions: [transactionSchema],
    pendingApprovals: [pendingApprovalSchema],
    settings: {
      freeParking: {
        type: Boolean,
        default: false, // Collect money on free parking
      },
      doubleGoSalary: {
        type: Boolean,
        default: false, // Double salary for landing exactly on GO
      },
    },
    startedAt: {
      type: Date,
    },
    finishedAt: {
      type: Date,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    endReason: {
      type: String,
      enum: ["manual", "idle_timeout", "host_left", "saved"],
      default: "manual",
    },
    // For resumed games - reference to original game and player balances
    resumedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
    },
    originalPlayerBalances: [{
      odishUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      balance: Number,
      color: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Generate unique code before saving
gameSchema.pre("save", async function (next) {
  if (!this.code) {
    let code;
    let isUnique = false;
    
    // Keep generating until we get a unique code
    while (!isUnique) {
      code = generateGameCode();
      const existingGame = await mongoose.model("Game").findOne({ 
        code, 
        status: { $in: ["waiting", "in_progress", "paused"] } 
      });
      if (!existingGame) {
        isUnique = true;
      }
    }
    this.code = code;
  }
  next();
});

// Auto-delete game when status changes to "finished" (only for manually ended games)
gameSchema.post("save", async function (doc) {
  if (doc.status === "finished" && doc.endReason === "manual") {
    // Only auto-delete manually ended games (not saved/idle/host_left)
    // Delete after a short delay to allow any final reads (only manual ends)
    setTimeout(async () => {
      try {
        await mongoose.model("Game").findByIdAndDelete(doc._id);
        console.log(`Game ${doc.code} deleted (finished manually)`);
      } catch (error) {
        console.error("Error auto-deleting finished game:", error.message);
      }
    }, 5000); // 5 second delay
  }
});

// Method to add player to game
gameSchema.methods.addPlayer = function (userId, isHost = false) {
  const existingPlayer = this.players.find(
    (p) => p.user.toString() === userId.toString()
  );
  
  if (existingPlayer) {
    throw new Error("Player already in game");
  }
  
  if (this.players.length >= this.maxPlayers) {
    throw new Error("Game is full");
  }
  
  // Assign a color that isn't taken
  const usedColors = this.players.map((p) => p.color);
  const availableColors = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"]
    .filter((c) => !usedColors.includes(c));
  
  this.players.push({
    user: userId,
    balance: this.startingBalance,
    color: availableColors[0],
    isHost,
    isReady: isHost, // Host is auto-ready
  });
  
  return this.players[this.players.length - 1];
};

// Method to remove player from game
gameSchema.methods.removePlayer = function (userId) {
  const userIdStr = userId.toString();
  const playerIndex = this.players.findIndex(
    (p) => {
      // Handle both populated (object with _id) and unpopulated (ObjectId) cases
      const playerId = p.user._id ? p.user._id.toString() : p.user.toString();
      return playerId === userIdStr;
    }
  );
  
  if (playerIndex === -1) {
    throw new Error("Player not in game");
  }
  
  this.players.splice(playerIndex, 1);
};

// Method to record a transaction
gameSchema.methods.recordTransaction = function (fromUserId, toUserId, amount, type, description) {
  this.transactions.push({
    from: fromUserId,
    to: toUserId,
    amount,
    type,
    description,
  });
};

// Virtual for player count
gameSchema.virtual("playerCount").get(function () {
  return this.players.length;
});

// Ensure virtuals are included in JSON
gameSchema.set("toJSON", { virtuals: true });
gameSchema.set("toObject", { virtuals: true });

const Game = mongoose.model("Game", gameSchema);

export default Game;
