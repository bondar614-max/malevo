import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sslCaPath = process.env.MYSQL_SSL_CA?.trim();
const ssl = sslCaPath
  ? { ca: readFileSync(sslCaPath, "utf8"), rejectUnauthorized: true }
  : process.env.MYSQL_SSL === "true"
    ? { rejectUnauthorized: true }
    : undefined;

export const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ...(ssl ? { ssl } : {}),
});
export const db = drizzle(pool, { schema, mode: "default" });

export * from "./schema";
