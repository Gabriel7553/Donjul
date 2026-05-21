import { Router, type IRouter } from "express";
import { getPool, hasDb } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const DEFAULT_USER = "default";

function userIdFrom(req: any): string {
  const h = req.header("x-user-id");
  if (typeof h === "string" && h.trim().length > 0 && h.length <= 128) return h.trim();
  const q = req.query?.uid;
  if (typeof q === "string" && q.trim().length > 0 && q.length <= 128) return q.trim();
  return DEFAULT_USER;
}

/** GET /api/state — pull full state blob for the user */
router.get("/state", async (req, res): Promise<void> => {
  if (!hasDb) { res.status(503).json({ error: "Database not configured" }); return; }
  try {
    const userId = userIdFrom(req);
    const { rows } = await getPool().query(
      "SELECT key, value, updated_at FROM kv_store WHERE user_id = $1",
      [userId]
    );
    const data: Record<string, { value: unknown; updatedAt: string }> = {};
    for (const r of rows) {
      data[r.key] = { value: r.value, updatedAt: r.updated_at.toISOString() };
    }
    res.json({ userId, data });
  } catch (err) {
    logger.error({ err }, "GET /state failed");
    res.status(500).json({ error: "Failed to load state" });
  }
});

/** PUT /api/state — push a single key/value pair */
router.put("/state", async (req, res): Promise<void> => {
  if (!hasDb) { res.status(503).json({ error: "Database not configured" }); return; }
  try {
    const userId = userIdFrom(req);
    const { key, value } = req.body ?? {};
    if (typeof key !== "string" || key.length === 0 || key.length > 256) {
      res.status(400).json({ error: "Invalid key" }); return;
    }
    if (value === undefined) { res.status(400).json({ error: "Missing value" }); return; }
    await getPool().query(
      `INSERT INTO kv_store (user_id, key, value, updated_at)
       VALUES ($1, $2, $3::jsonb, now())
       ON CONFLICT (user_id, key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [userId, key, JSON.stringify(value)]
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "PUT /state failed");
    res.status(500).json({ error: "Failed to save state" });
  }
});

export default router;
