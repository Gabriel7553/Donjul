import { Router, type IRouter } from "express";
import { getPool, hasDb } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEFAULT_USER = "default";
const TRANSFER_PREFIX = "sync-";

function userIdFrom(req: any): string {
  const h = req.header("x-user-id");
  if (typeof h === "string" && h.trim().length > 0 && h.length <= 128) {
    return h.trim();
  }
  const q = req.query?.uid;
  if (typeof q === "string" && q.trim().length > 0 && q.length <= 128) {
    return q.trim();
  }
  return DEFAULT_USER;
}

router.post("/sync/claim", async (req, res): Promise<void> => {
  if (!hasDb) { res.status(503).json({ error: "Database not configured" }); return; }
  try {
    const { transferKey } = req.body ?? {};
    if (typeof transferKey !== "string" || !transferKey.startsWith(TRANSFER_PREFIX) || transferKey.length < 12 || transferKey.length > 128) {
      res.status(400).json({ error: "Invalid transfer key" }); return;
    }
    const userId = `u:${transferKey}`;
    res.json({ ok: true, userId });
  } catch (err) {
    logger.error({ err }, "sync/claim failed");
    res.status(500).json({ error: "Claim failed" });
  }
});

router.get("/sync/pull", async (req, res): Promise<void> => {
  if (!hasDb) { res.status(503).json({ error: "Database not configured" }); return; }
  try {
    const userId = userIdFrom(req);
    const { rows } = await getPool().query(
      "SELECT key, value, updated_at FROM kv_store WHERE user_id = $1",
      [userId],
    );
    const data: Record<string, { value: unknown; updatedAt: string }> = {};
    for (const r of rows) {
      data[r.key] = { value: r.value, updatedAt: r.updated_at.toISOString() };
    }
    res.json({ userId, data });
  } catch (err) {
    logger.error({ err }, "sync/pull failed");
    res.status(500).json({ error: "Pull failed" });
  }
});

router.get("/sync/latest", async (req, res): Promise<void> => {
  if (!hasDb) { res.status(503).json({ error: "Database not configured" }); return; }
  try {
    const { rows } = await getPool().query(
      `SELECT s.user_id
       FROM kv_store s
       WHERE s.key = 'st:settings'
         AND s.value->>'setupComplete' = 'true'
       ORDER BY (
         SELECT MAX(k.updated_at) FROM kv_store k WHERE k.user_id = s.user_id
       ) DESC
       LIMIT 1`,
    );
    if (rows.length === 0) { res.json({ userId: null }); return; }
    res.json({ userId: rows[0].user_id });
  } catch (err) {
    logger.error({ err }, "sync/latest failed");
    res.status(500).json({ error: "Latest failed" });
  }
});

router.post("/sync/push", async (req, res): Promise<void> => {
  if (!hasDb) { res.status(503).json({ error: "Database not configured" }); return; }
  try {
    const userId = userIdFrom(req);
    const { key, value } = req.body ?? {};
    if (typeof key !== "string" || key.length === 0 || key.length > 256) {
      res.status(400).json({ error: "Invalid key" }); return;
    }
    if (value === undefined) {
      res.status(400).json({ error: "Missing value" }); return;
    }
    await getPool().query(
      `INSERT INTO kv_store (user_id, key, value, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [userId, key, JSON.stringify(value)],
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "sync/push failed");
    res.status(500).json({ error: "Push failed" });
  }
});

export default router;
