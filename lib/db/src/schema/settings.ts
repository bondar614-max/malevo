import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

/** Generic key/value store for app-wide configuration (e.g. AI model per category). */
export const appSettingsTable = pgTable("app_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
