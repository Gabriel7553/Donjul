import pg from "pg";
import { logger } from "./logger";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

export const hasDb = Boolean(DATABASE_URL);

if (!hasDb) {
  logger.warn("DATABASE_URL not set — sync routes will return 503.");
}

let pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}
