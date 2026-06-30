import { randomUUID } from "node:crypto";
import { timestamp, varchar } from "drizzle-orm/mysql-core";

export function uuidColumn(name: string) {
  return varchar(name, { length: 36 }).$defaultFn(() => randomUUID());
}

export function dateTimeColumn(name: string) {
  return timestamp(name, { mode: "date" });
}

