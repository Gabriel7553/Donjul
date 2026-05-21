import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { logger } from "../lib/logger";

const SYNC_SHARED_SECRET = process.env.SYNC_SHARED_SECRET;

export const syncAuthEnabled = Boolean(SYNC_SHARED_SECRET);

if (!syncAuthEnabled) {
  logger.warn(
    "SYNC_SHARED_SECRET is not set — cloud-sync endpoints (/api/state) are unauthenticated and readable/writable by anyone who can reach the server.",
  );
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Guards the cloud-sync endpoints. When SYNC_SHARED_SECRET is unset the
// endpoints stay open (backward compatible); when set, a matching
// `Authorization: Bearer <secret>` header is required.
export function requireSyncSecret(req: Request, res: Response, next: NextFunction) {
  if (!SYNC_SHARED_SECRET) {
    next();
    return;
  }
  const header = req.headers.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !safeEqual(token, SYNC_SHARED_SECRET)) {
    res.status(401).json({ error: "Unauthorized: a valid sync access code is required." });
    return;
  }
  next();
}
