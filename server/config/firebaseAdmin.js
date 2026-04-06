import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadServiceAccount = () => {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountString) {
    try {
      return JSON.parse(serviceAccountString);
    } catch (error) {
      throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ${error.message}`);
    }
  }

  const explicitPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE || process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  const candidatePaths = [];

  if (explicitPath) {
    const resolved = path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(process.cwd(), explicitPath);
    candidatePaths.push(resolved);
  }

  candidatePaths.push(path.resolve(__dirname, "firebase-service-account.json"));

  for (const filePath of candidatePaths) {
    if (!filePath) continue;
    if (!fs.existsSync(filePath)) continue;

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to read Firebase service account from ${filePath}: ${error.message}`);
    }
  }

  throw new Error(
    "Firebase Admin SDK requires credentials. Set FIREBASE_SERVICE_ACCOUNT env var, FIREBASE_SERVICE_ACCOUNT_FILE, " +
      "or place config/firebase-service-account.json in the server directory."
  );
};

if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
