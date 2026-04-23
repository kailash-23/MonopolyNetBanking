import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const internalSession = await verifyInternalToken(token);

    if (!internalSession) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.firebaseUser = internalSession.decoded;
    req.firebaseUid = internalSession.firebaseUid;
    req.userEmail = internalSession.userEmail;
    req.user = internalSession.user;
    req.userId = internalSession.user._id.toString();

    next();
  } catch (error) {
    console.error("verifyFirebaseToken error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
