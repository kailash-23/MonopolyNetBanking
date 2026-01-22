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
    default: 1500, // Standard Monopoly starting money
  },
  color: {
    type: String,
    enum: ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"],
  },
  isReady: {
    type: Boolean,
    default: false,
  },
  isHost: {
    type: Boolean,
    default: false,
  },
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
  const playerIndex = this.players.findIndex(
    (p) => p.user.toString() === userId.toString()
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
