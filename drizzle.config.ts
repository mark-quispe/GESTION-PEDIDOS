import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Sin DATABASE_URL se trabaja contra la base local (PGlite en .pglite).
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : { driver: "pglite", dbCredentials: { url: ".pglite" } }),
});
