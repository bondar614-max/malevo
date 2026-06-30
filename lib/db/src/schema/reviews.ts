import { mysqlTable, varchar, text, int } from "drizzle-orm/mysql-core";
import { dateTimeColumn, uuidColumn } from "./_helpers";

export const reviewsTable = mysqlTable("reviews", {
  id: uuidColumn("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  avatarColor: varchar("avatar_color", { length: 32 }).notNull().default("#7C3AED"),
  rating: int("rating").notNull().default(5),
  text: text("text").notNull(),
  styleTag: varchar("style_tag", { length: 255 }).notNull(),
  createdAt: dateTimeColumn("created_at").notNull().defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
