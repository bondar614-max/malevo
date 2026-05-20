import { pgTable, uuid, varchar, text, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { stylesTable } from "./styles";
import { servicesTable, locationsTable } from "./services";

export const ordersTable = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id),
  styleId: uuid("style_id").references(() => stylesTable.id),
  serviceKey: varchar("service_key", { length: 64 }).references(() => servicesTable.key),
  locationId: uuid("location_id").references(() => locationsTable.id),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  sourcePhotoUrl: varchar("source_photo_url", { length: 500 }),
  sourcePhotos: jsonb("source_photos").$type<string[]>().notNull().default([]),
  resultPhotos: jsonb("result_photos").$type<string[]>().notNull().default([]),
  kieTaskId: varchar("kie_task_id", { length: 255 }),
  paymentId: varchar("payment_id", { length: 255 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Order = typeof ordersTable.$inferSelect;
