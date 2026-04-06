#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";
import admin from "../config/firebaseAdmin.js";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadEnvFile = (relativePath) => {
  const fullPath = path.resolve(__dirname, relativePath);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
  }
};

loadEnvFile("../../.env");
loadEnvFile("../../.env.local");
loadEnvFile("../.env");
loadEnvFile("../.env.local");

dotenv.config();

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

if (!process.env.MONGO_URI) {
  console.error("[migrate-users] Missing MONGO_URI. Populate it in .env or server/.env first.");
  process.exit(1);
}

const summary = {
  total: 0,
  linked: 0,
  created: 0,
  skipped: 0,
  errors: 0,
};

const randomPassword = () => crypto.randomBytes(24).toString("base64");

const fetchFirebaseUser = async ({ firebaseUid, email }) => {
  if (firebaseUid) {
    try {
      return await admin.auth().getUser(firebaseUid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }
  }

  if (email) {
    try {
      return await admin.auth().getUserByEmail(email);
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }
  }

  return null;
};

const migrateUser = async (user) => {
  summary.total += 1;
  const label = `${user.username || user.email || user.uid || user._id}`;

  try {
    const existing = await fetchFirebaseUser(user);

    if (existing) {
      if (!dryRun && user.firebaseUid !== existing.uid) {
        user.firebaseUid = existing.uid;
        await user.save({ validateBeforeSave: false });
      }
      summary.linked += 1;
      console.log(`✔ Linked ${label} -> ${existing.uid}`);
      return;
    }

    if (!user.email) {
      summary.skipped += 1;
      console.warn(`⚠ Skipping ${label}: no email on record`);
      return;
    }

    if (dryRun) {
      summary.created += 1;
      console.log(`ℹ️ DRY RUN: would create Firebase user for ${label}`);
      return;
    }

    const newRecord = await admin.auth().createUser({
      email: user.email,
      displayName: user.displayName || user.username || user.uid,
      password: randomPassword(),
    });

    user.firebaseUid = newRecord.uid;
    await user.save({ validateBeforeSave: false });
    summary.created += 1;
    console.log(`✅ Created Firebase user for ${label} -> ${newRecord.uid}`);
  } catch (error) {
    summary.errors += 1;
    console.error(`❌ Failed to migrate ${label}:`, error.message || error);
  }
};

const run = async () => {
  await connectDB();
  const query = User.find({}).sort({ createdAt: 1 });
  if (typeof limit === "number" && !Number.isNaN(limit)) {
    query.limit(limit);
  }

  const users = await query.exec();

  for (const user of users) {
    await migrateUser(user);
  }

  await mongoose.disconnect();

  console.log("\nMigration summary:");
  console.table(summary);

  if (summary.errors > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("[migrate-users] Unexpected error:", error);
  process.exit(1);
});
