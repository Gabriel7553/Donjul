import { pgTable, text, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const kvStore = pgTable(
  "kv_store",
  {
    userId: text("user_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })]
);

export type KvRow = typeof kvStore.$inferSelect;
