import { pgTable, uuid, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

export const reviewsTable = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  avatarColor: varchar("avatar_color", { length: 32 }).notNull().default("#7C3AED"),
  rating: integer("rating").notNull().default(5),
  text: text("text").notNull(),
  styleTag: varchar("style_tag", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Review = typeof reviewsTable.$inferSelect;
