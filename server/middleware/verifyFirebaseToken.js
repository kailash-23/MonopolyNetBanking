import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import admin from "../config/firebaseAdmin.js";
import User from "../models/User.js";

const normalizeEmail = (email) => (typeof email === "string" ? email.toLowerCase().trim() : undefined);

const verifyInternalToken = async (token) => {
  if (!process.env.JWT_SECRET) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.userId) {
      return null;
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return null;
    }

    return {
      decoded,
      user,
      firebaseUid: decoded.firebaseUid || user.firebaseUid || null,
      userEmail: user.email || decoded.email || null,
    };
  } catch (error) {
    if (error && error.name !== "TokenExpiredError") {
      console.warn("Internal auth token verification failed:", error.message);
    }
    return null;
  }
};

const findUserFromDecodedToken = async (decoded) => {
  const { uid, email, user_id: userIdClaim, sub } = decoded || {};
  const firebaseCandidates = [uid, userIdClaim, sub].filter(Boolean);

  for (const candidate of firebaseCandidates) {
    const user = await User.findOne({ firebaseUid: candidate });
    if (user) return user;
  }

  // Backward compatibility: allow matching by Mongo ObjectId embedded in token
  for (const candidate of firebaseCandidates) {
    if (mongoose.Types.ObjectId.isValid(candidate)) {
      const user = await User.findById(candidate);
      if (user) return user;
    }
  }

  // Legacy support for users whose Monopoly UID may have been set to Firebase UID
  for (const candidate of firebaseCandidates) {
    const user = await User.findOne({ uid: candidate });
    if (user) return user;
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail) {
    const userByEmail = await User.findOne({ email: normalizedEmail });
    if (userByEmail) return userByEmail;
  }

  return null;
};

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const internalSession = await verifyInternalToken(token);

    if (internalSession) {
      req.firebaseUser = internalSession.decoded;
      req.firebaseUid = internalSession.firebaseUid;
      req.userEmail = internalSession.userEmail;
      req.user = internalSession.user;
      req.userId = internalSession.user._id.toString();
      return next();
    }

    const decoded = await admin.auth().verifyIdToken(token);
    const firebaseUid = decoded?.uid || decoded?.user_id || decoded?.sub || null;

    req.firebaseUser = decoded;
    req.firebaseUid = firebaseUid;
    req.userEmail = decoded.email || null;

    const user = await findUserFromDecodedToken(decoded);
    if (!user) {
      if (!req.allowMissingUser) {
        return res.status(401).json({ message: "User record not found. Please complete sign up." });
      }
      req.user = null;
      req.userId = null;
      return next();
    }

    req.user = user;
    req.userId = user._id.toString();

    next();
  } catch (error) {
    console.error("verifyFirebaseToken error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
