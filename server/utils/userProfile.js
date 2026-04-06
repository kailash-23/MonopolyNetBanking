import crypto from "crypto";
import User from "../models/User.js";

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

export const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : undefined;

export const deriveAuthProvider = (firebaseUser) => {
  const providerId = firebaseUser?.firebase?.sign_in_provider || firebaseUser?.sign_in_provider;
  if (!providerId) return "local";
  if (providerId.includes("google")) return "google";
  if (providerId.includes("apple")) return "apple";
  return "local";
};

const sanitizeUsername = (value) =>
  typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, USERNAME_MAX_LENGTH)
    : "";

const ensureUniqueUsername = async (rawValue) => {
  const base = sanitizeUsername(rawValue);
  if (!base || base.length < USERNAME_MIN_LENGTH) {
    return null;
  }

  let candidate = base;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    const suffixText = `${suffix}`;
    const trimmedBase = base.slice(0, Math.max(USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH - suffixText.length));
    candidate = `${trimmedBase}${suffixText}`;
    suffix += 1;
    if (suffix > 9999) {
      return null;
    }
  }

  return candidate;
};

export const generateUsername = async (seeds = []) => {
  for (const seed of seeds) {
    const unique = await ensureUniqueUsername(seed);
    if (unique) return unique;
  }

  while (true) {
    const fallbackSeed = `player${crypto.randomBytes(3).toString("hex")}`;
    const unique = await ensureUniqueUsername(fallbackSeed);
    if (unique) return unique;
  }
};
