import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Single-row JSON blob of the whole app state (personal, single-user app — no auth).
export const appStateTable = pgTable("app_state", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppStateRow = typeof appStateTable.$inferSelect;
