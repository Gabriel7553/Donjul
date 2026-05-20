import { Router, type IRouter } from "express";
import { getPool, hasDb } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEFAULT_USER = "default";

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

router.get("/sync/pull", async (req, res) => {
  if (!hasDb) return res.status(503).json({ error: "Database not configured" });
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

router.post("/sync/push", async (req, res) => {
  if (!hasDb) return res.status(503).json({ error: "Database not configured" });
  try {
    const userId = userIdFrom(req);
    const { key, value } = req.body ?? {};
    if (typeof key !== "string" || key.length === 0 || key.length > 256) {
      return res.status(400).json({ error: "Invalid key" });
    }
    if (value === undefined) {
      return res.status(400).json({ error: "Missing value" });
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
