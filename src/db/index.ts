import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Solo desarrollo: permite usar un Postgres local detrás de un proxy HTTP compatible con Neon.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT;

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema, casing: "snake_case" });
