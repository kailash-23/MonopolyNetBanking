import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateResetToken, hashToken, sendPasswordResetEmail } from "../config/email.js";

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    if (username.length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists. Please choose a different one." });
    }

    // Create user
    const user = await User.create({
      username: username.toLowerCase(),
      password,
    });

    res.status(201).json({
      user: user.toJSON(),
      message: "Account created successfully",
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// @route   POST /api/auth/signin
// @desc    Authenticate user & get token
// @access  Public
router.post("/signin", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    // Find user
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// @route   POST /api/auth/complete-profile
// @desc    Complete profile setup for new OAuth users
// @access  Private
router.post("/complete-profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { username, displayName } = req.body;

    // Validate username
    if (!username || username.length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters" });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
    }

    // Check if username is taken
    const existingUser = await User.findOne({ 
      username: username.toLowerCase(),
      _id: { $ne: user._id }
    });

    if (existingUser) {
      return res.status(400).json({ message: "Username is already taken" });
    }

    // Update user profile
    user.username = username.toLowerCase();
    if (displayName) user.displayName = displayName;
    user.isProfileComplete = true;
    await user.save();

    res.json({
      user: user.toJSON(),
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Complete profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// @route   POST /api/auth/check-username
// @desc    Check if username is available
// @access  Public
router.post("/check-username", async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || username.length < 3) {
      return res.json({ available: false, message: "Username must be at least 3 characters" });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase() });
    
    res.json({ 
      available: !existingUser,
      message: existingUser ? "Username is taken" : "Username is available"
    });
  } catch (error) {
    res.status(500).json({ available: false, message: "Error checking username" });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(401).json({ message: "Not authorized" });
  }
});

// @route   POST /api/auth/oauth/google
// @desc    Authenticate with Google
// @access  Public
router.post("/oauth/google", async (req, res) => {
  try {
    const { googleId, email, name, picture } = req.body;
    
    if (!googleId || !email) {
      return res.status(400).json({ message: "Invalid Google authentication data" });
    }

    // Find or create user
    let user = await User.findOne({ googleId });
    let isNewUser = false;
    
    if (!user) {
      // Check if email is already used
      user = await User.findOne({ email });
      
      if (user) {
        // Link Google account to existing user
        user.googleId = googleId;
        user.avatar = user.avatar || picture;
        user.displayName = user.displayName || name;
        await user.save();
      } else {
        // Create new user with Google - mark as needing profile setup
        isNewUser = true;
        
        // Create a temporary username (will be updated during profile setup)
        const tempUsername = `google_${googleId.slice(-8)}`;
        
        user = await User.create({
          username: tempUsername,
          email,
          displayName: name,
          avatar: picture,
          googleId,
          authProvider: 'google',
          isProfileComplete: false, // New user needs to set up profile
        });
      }
    }

    const token = generateToken(user._id);

    res.json({
      user: user.toJSON(),
      token,
      isNewUser, // Indicates if user needs to complete profile setup
    });
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});

// @route   POST /api/auth/oauth/apple
// @desc    Authenticate with Apple
// @access  Public
router.post("/oauth/apple", async (req, res) => {
  try {
    const { identityToken, user: appleUser } = req.body;
    
    // Decode Apple identity token
    const base64Url = identityToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
    
    const { sub: appleId, email } = payload;
    const name = appleUser?.name ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim() : null;

    // Find or create user
    let user = await User.findOne({ appleId });
    
    if (!user) {
      if (email) {
        user = await User.findOne({ email });
      }
      
      if (user) {
        // Link Apple account to existing user
        user.appleId = appleId;
        user.displayName = user.displayName || name;
        await user.save();
      } else {
        // Create new user with Apple
        const baseName = (email?.split('@')[0] || 'apple_user').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
        let uniqueUsername = baseName;
        let counter = 1;
        
        while (await User.findOne({ username: uniqueUsername })) {
          uniqueUsername = `${baseName.slice(0, 17)}${counter}`;
          counter++;
        }
        
        user = await User.create({
          username: uniqueUsername,
          email,
          displayName: name,
          appleId,
          authProvider: 'apple',
        });
      }
    }

    const token = generateToken(user._id);

    res.json({
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    console.error("Apple OAuth error:", error);
    res.status(500).json({ message: "Apple authentication failed" });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile (username, displayName)
// @access  Private
router.put("/profile", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { username, displayName, email } = req.body;

    // Validate and update username if provided
    if (username && username !== user.username) {
      if (username.length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
      }
      const existingUser = await User.findOne({ 
        username: username.toLowerCase(),
        _id: { $ne: user._id }
      });
      if (existingUser) {
        return res.status(400).json({ 
          success: false,
          message: `Username "${username}" is already taken. Please choose a different username.` 
        });
      }
      user.username = username.toLowerCase();
    }

    if (displayName !== undefined) user.displayName = displayName;
    if (email !== undefined) user.email = email;

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

// @route   PUT /api/auth/password
// @desc    Change user password
// @access  Private
router.put("/password", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { currentPassword, newPassword } = req.body;

    // For OAuth users without password, allow setting new password
    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
});

// @route   PUT /api/auth/settings
// @desc    Update user settings
// @access  Private
router.put("/settings", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { settings } = req.body;

    if (settings) {
      user.settings = { ...user.settings, ...settings };
    }

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

// @route   GET /api/auth/stats
// @desc    Get user stats and game history
// @access  Private
router.get("/stats", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const winRate = user.stats.gamesPlayed > 0 
      ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100) 
      : 0;

    res.json({
      stats: {
        ...user.stats,
        winRate: `${winRate}%`,
      },
      gameHistory: user.gameHistory.slice(-10).reverse(), // Last 10 games
    });
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// @route   POST /api/auth/password-reset
// @desc    Send password reset email
// @access  Public
router.post("/password-reset", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ 
        success: true,
        message: "If an account with that email exists, a password reset link has been sent." 
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const hashedToken = hashToken(resetToken);
    
    // Save token to user with 1 hour expiry
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send email
    try {
      await sendPasswordResetEmail(email, resetToken, user.displayName || user.username);
      console.log(`Password reset email sent to: ${email}`);
    } catch (emailError) {
      // If email fails, clear the token
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({ 
        success: false,
        message: "Failed to send password reset email. Please try again later." 
      });
    }

    res.json({ 
      success: true,
      message: "If an account with that email exists, a password reset link has been sent." 
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Failed to process password reset request" });
  }
});

export default router;
