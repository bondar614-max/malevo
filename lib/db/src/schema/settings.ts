import { mysqlTable, varchar, text } from "drizzle-orm/mysql-core";
import { dateTimeColumn } from "./_helpers";

/** Generic key/value store for app-wide configuration (e.g. AI model per category). */
export const appSettingsTable = mysqlTable("app_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: dateTimeColumn("updated_at").notNull().defaultNow(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
