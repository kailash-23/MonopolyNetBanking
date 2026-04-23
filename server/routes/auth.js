import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import passport from "passport";
import User from "../models/User.js";
import { verifyAuthToken } from "../middleware/verifyAuthToken.js";
import { generateUsername, normalizeEmail } from "../utils/userProfile.js";
import { generateResetToken, hashToken, sendPasswordResetEmail } from "../config/email.js";

const router = express.Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const GOOGLE_AUTH_ENABLED = Boolean(
  process.env.GOOGLE_CLIENT_ID && (process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_SECRET_ID)
);
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

const normalizeUsernameValue = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const validateUsername = (value) => {
  const normalized = normalizeUsernameValue(value);
  if (!normalized) {
    return { valid: false, message: "Username is required" };
  }
  if (!USERNAME_PATTERN.test(normalized)) {
    return {
      valid: false,
      message: "Username must be 3-20 characters and use letters, numbers, or underscores",
    };
  }
  return { valid: true, value: normalized };
};

const issueAppToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET for token issuance");
  }

  const payload = {
    userId: user._id.toString(),
    authProvider: user.authProvider || "local",
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const redirectToFrontend = (res, params = {}) => {
  const url = new URL(`${FRONTEND_URL}/oauth-success`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  res.redirect(url.toString());
};

const buildSyncPayload = (user) => {
  const needsProfileSetup = user.isProfileComplete !== true;
  const payload = { user: user.toJSON() };
  if (needsProfileSetup) {
    payload.needsProfileSetup = true;
  }
  return payload;
};

const validatePassword = (password) => {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
    };
  }
  return { valid: true };
};

router.post("/signup", async (req, res) => {
  try {
    const { email, password, displayName } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const username = await generateUsername([
      req.body?.username,
      displayName,
      normalizedEmail.split("@")[0],
    ]);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email: normalizedEmail,
      password: passwordHash,
      displayName: typeof displayName === "string" && displayName.trim() ? displayName.trim() : "Player",
      username,
      authProvider: "local",
      isProfileComplete: false,
    });

    const token = issueAppToken(user);
    return res.status(201).json({
      token,
      ...buildSyncPayload(user),
    });
  } catch (error) {
    console.error("Sign up error:", error);
    return res.status(500).json({ message: "Failed to create account" });
  }
});

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || typeof password !== "string") {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: normalizedEmail }).select("+password");
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = issueAppToken(user);
    return res.json({
      token,
      ...buildSyncPayload(user),
    });
  } catch (error) {
    console.error("Sign in error:", error);
    return res.status(500).json({ message: "Failed to sign in" });
  }
});

router.get("/google", (req, res, next) => {
  if (!GOOGLE_AUTH_ENABLED) {
    return res.status(503).json({ message: "Google OAuth is not configured" });
  }

  const state = req.query.state ? String(req.query.state) : undefined;
  return passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    state,
    session: false,
  })(req, res, next);
});

router.get(
  "/google/callback",
  (req, res, next) => {
    if (!GOOGLE_AUTH_ENABLED) {
      return res.redirect(`${FRONTEND_URL}/signin?error=google_oauth_disabled`);
    }
    next();
  },
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND_URL}/signin?error=google_auth_failed`,
    session: false,
  }),
  async (req, res) => {
    try {
      const token = issueAppToken(req.user);
      redirectToFrontend(res, {
        token,
        needsProfileSetup: req.user.isProfileComplete ? "0" : "1",
      });
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect(`${FRONTEND_URL}/signin?error=google_auth_failed`);
    }
  }
);

router.get("/me", verifyAuthToken, (req, res) => {
  if (!req.user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({ user: req.user.toJSON() });
});

router.post("/complete-profile", verifyAuthToken, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { username, displayName } = req.body || {};
    const validation = validateUsername(username);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const existingUser = await User.findOne({
      username: validation.value,
      _id: { $ne: req.user._id },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    req.user.username = validation.value;
    if (typeof displayName === "string") {
      const trimmedName = displayName.trim();
      if (trimmedName) {
        req.user.displayName = trimmedName;
      }
    }
    req.user.isProfileComplete = true;
    await req.user.save();

    res.json({
      user: req.user.toJSON(),
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Complete profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.post("/check-username", async (req, res) => {
  try {
    const { username } = req.body || {};
    const validation = validateUsername(username);
    if (!validation.valid) {
      return res.json({ available: false, message: validation.message });
    }

    const existingUser = await User.findOne({ username: validation.value });
    return res.json({
      available: !existingUser,
      message: existingUser ? "Username is taken" : "Username is available",
    });
  } catch (error) {
    console.error("Check username error:", error);
    res.status(500).json({ available: false, message: "Error checking username" });
  }
});

router.put("/profile", verifyAuthToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { username, displayName, avatar } = req.body || {};

    if (username && username !== user.username) {
      const validation = validateUsername(username);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.message });
      }

      const existingUser = await User.findOne({
        username: validation.value,
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: `Username "${username}" is already taken. Please choose a different username.`,
        });
      }

      user.username = validation.value;
    }

    if (typeof displayName === "string") {
      user.displayName = displayName.trim();
    }

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    await user.save();

    res.json({
      user: user.toJSON(),
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.put("/settings", verifyAuthToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { settings } = req.body || {};
    if (!settings || typeof settings !== "object") {
      return res.status(400).json({ message: "Settings payload is required" });
    }

    user.settings = { ...user.settings, ...settings };
    await user.save();

    res.json({
      user: user.toJSON(),
      message: "Settings updated successfully",
    });
  } catch (error) {
    console.error("Settings update error:", error);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

router.get("/stats", verifyAuthToken, (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const stats = user.stats || {};
    const gamesPlayed = stats.gamesPlayed || 0;
    const gamesWon = stats.gamesWon || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

    res.json({
      stats: {
        gamesPlayed,
        gamesWon,
        totalEarnings: stats.totalEarnings || 0,
        winRate: `${winRate}%`,
      },
      gameHistory: (user.gameHistory || []).slice(-10).reverse(),
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

router.post("/password-reset", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null;

    if (!user) {
      return res.json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent.",
      });
    }

    const resetToken = generateResetToken();
    const hashedToken = hashToken(resetToken);
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    try {
      await sendPasswordResetEmail(email, resetToken, user.displayName || user.username);
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      console.error("Failed to send password reset email:", emailError);
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email. Please try again later.",
      });
    }

    res.json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Failed to process password reset request" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    user.password = await bcrypt.hash(password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
