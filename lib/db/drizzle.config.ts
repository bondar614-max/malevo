import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
    ssl: process.env.MYSQL_SSL_CA
      ? { ca: process.env.MYSQL_SSL_CA }
      : process.env.MYSQL_SSL === "true"
        ? true
        : undefined,
  },
});
