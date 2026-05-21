import { Router } from "express";
import { logger } from "../lib/logger";
import { requireSyncSecret } from "../middlewares/requireSyncSecret";
import { isPlainObject, MAX_STATE_BYTES } from "../lib/validate";

const router = Router();

export const hasDatabase = Boolean(process.env.DATABASE_URL);

const STATE_ID = "default";

// Import @workspace/db lazily so a missing DATABASE_URL never crashes the server at startup.
let dbMod: any = null;
async function getDb() {
  if (!hasDatabase) return null;
  if (!dbMod) dbMod = await import("@workspace/db");
  return dbMod;
}

router.get("/state", requireSyncSecret, async (_req, res) => {
  if (!hasDatabase) return res.status(503).json({ error: "Cloud sync is not configured (no DATABASE_URL)." });
  try {
    const { db, appStateTable, eq } = await loadDb();
    const rows = await db.select().from(appStateTable).where(eq(appStateTable.id, STATE_ID)).limit(1);
    if (!rows.length) return res.json({ data: null, updatedAt: null });
    return res.json({ data: rows[0].data, updatedAt: rows[0].updatedAt });
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "GET /state failed");
    return res.status(500).json({ error: "Could not load saved data." });
  }
});

router.put("/state", requireSyncSecret, async (req, res) => {
  if (!hasDatabase) return res.status(503).json({ error: "Cloud sync is not configured (no DATABASE_URL)." });
  const { data } = req.body as { data?: any };
  if (!isPlainObject(data)) return res.status(400).json({ error: "Missing data." });
  if (JSON.stringify(data).length > MAX_STATE_BYTES) {
    return res.status(413).json({ error: "Saved data is too large to sync." });
  }
  try {
    const { db, appStateTable } = await loadDb();
    const updatedAt = new Date();
    await db
      .insert(appStateTable)
      .values({ id: STATE_ID, data, updatedAt })
      .onConflictDoUpdate({ target: appStateTable.id, set: { data, updatedAt } });
    return res.json({ ok: true, updatedAt });
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "PUT /state failed");
    return res.status(500).json({ error: "Could not save data." });
  }
});

async function loadDb() {
  const mod = await getDb();
  const { eq } = await import("drizzle-orm");
  return { db: mod.db, appStateTable: mod.appStateTable, eq };
}

export default router;
