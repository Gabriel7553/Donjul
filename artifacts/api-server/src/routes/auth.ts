import { Router, type IRouter } from "express";
import { getPool, hasDb } from "../lib/db";
import { logger } from "../lib/logger";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const router: IRouter = Router();
const scryptAsync = promisify(scrypt);

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  try {
    await getPool().query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await getPool().query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`);
    tableReady = true;
  } catch (err) {
    logger.error({ err }, "Failed to create users table");
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, hash] = stored.split(":");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedBuf = Buffer.from(hash, "hex");
    return derivedKey.length === storedBuf.length && timingSafeEqual(derivedKey, storedBuf);
  } catch {
    return false;
  }
}

router.post("/auth/register", async (req, res): Promise<void> => {
  if (!hasDb) { res.status(503).json({ error: "Database not configured" }); return; }
  await ensureTable();
  const { username, password, email } = req.body ?? {};
  if (!username || typeof username !== "string" || username.length < 2 || username.length > 32) {
    res.status(400).json({ error: "Username must be 2–32 characters" }); return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" }); return;
  }
  const clean = username.toLowerCase().trim();
  if (!/^[a-z0-9_]+$/.test(clean)) {
    res.status(400).json({ error: "Username can only contain letters, numbers and underscores" }); return;
  }
  let cleanEmail: string | null = null;
  if (email != null && String(email).trim() !== "") {
    cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: "Enter a valid email or leave it blank" }); return;
    }
  }
  try {
    const hash = await hashPassword(password);
    const { rows } = await getPool().query(
      "INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username",
      [clean, hash, cleanEmail],
    );
    res.json({ userId: rows[0].id, username: rows[0].username });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "That username is already taken" }); return;
    }
    logger.error({ err }, "auth/register failed");
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  if (!hasDb) { res.status(503).json({ error: "Database not configured" }); return; }
  await ensureTable();
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" }); return;
  }
  const clean = String(username).toLowerCase().trim();
  try {
    const { rows } = await getPool().query(
      "SELECT id, username, password_hash FROM users WHERE username = $1",
      [clean],
    );
    if (rows.length === 0) {
      res.status(401).json({ error: "Invalid username or password" }); return;
    }
    const ok = await verifyPassword(String(password), rows[0].password_hash);
    if (!ok) {
      res.status(401).json({ error: "Invalid username or password" }); return;
    }
    res.json({ userId: rows[0].id, username: rows[0].username });
  } catch (err) {
    logger.error({ err }, "auth/login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
