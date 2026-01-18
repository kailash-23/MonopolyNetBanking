import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Generate unique UID
const generateUID = () => {
  return 'MP' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      unique: true,
      default: generateUID,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [20, "Username must be 20 characters or less"],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
    },
    // OAuth provider IDs
    googleId: {
      type: String,
      sparse: true,
    },
    appleId: {
      type: String,
      sparse: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "apple"],
      default: "local",
    },
    isProfileComplete: {
      type: Boolean,
      default: true,
    },
    // Game Statistics
    stats: {
      gamesPlayed: { type: Number, default: 0 },
      gamesWon: { type: Number, default: 0 },
      totalEarnings: { type: Number, default: 0 },
      favoriteProperty: { type: String, default: null },
      longestStreak: { type: Number, default: 0 },
      currentStreak: { type: Number, default: 0 },
    },
    // Game History
    gameHistory: [{
      gameId: String,
      date: { type: Date, default: Date.now },
      players: Number,
      result: { type: String, enum: ['Won', 'Lost'] },
      earnings: Number,
      edition: String,
    }],
    // Settings
    settings: {
      soundEnabled: { type: Boolean, default: true },
      notificationsEnabled: { type: Boolean, default: true },
      darkMode: { type: Boolean, default: true },
      language: { type: String, default: 'en' },
    },
    // Friends System
    friends: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    friendRequests: {
      sent: [{
        to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sentAt: { type: Date, default: Date.now }
      }],
      received: [{
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        receivedAt: { type: Date, default: Date.now }
      }]
    },
    // Password Reset
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", userSchema);

export default User;
