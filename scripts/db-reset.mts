/**
 * Borra la base local (.pglite) y la vuelve a crear con el tarifario y el estudio ficticio.
 * Uso: pnpm db:reset   (solo desarrollo; no toca Neon)
 */
import { rmSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";
import { seedIfEmpty } from "../src/db/seed";
import type { DB } from "../src/db";

const dir = process.env.PGLITE_DIR ?? ".pglite";
rmSync(dir, { recursive: true, force: true });
const client = new PGlite(dir);
const db = drizzle(client, { schema, casing: "snake_case" });
await migrate(db, { migrationsFolder: "drizzle" });
await seedIfEmpty(db as unknown as DB);
const r = await client.query<{ n: number }>("select (select count(*) from jobs)::int as n");
console.log(`Base local lista: ${r.rows[0].n} trabajos de prueba.`);
await client.close();
