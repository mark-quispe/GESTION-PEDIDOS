import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import * as schema from "./schema";

/**
 * Base de datos.
 * - Producción y preview: Neon por HTTP (DATABASE_URL).
 * - Desarrollo sin DATABASE_URL: PGlite, un Postgres que corre dentro de Node y
 *   guarda los datos en la carpeta .pglite. No hay que instalar nada.
 * Las dos exponen la misma API de Drizzle; `batch` agrupa escrituras que deben
 * ir juntas (cambio + historial, CLAUDE.md).
 */
export type DB = NeonHttpDatabase<typeof schema>;

type Local = { db: DB; exec: (sql: string) => Promise<unknown>; ready: Promise<void> };

const g = globalThis as unknown as { __pglite?: Local; __neonDb?: DB };

export const isLocalDb = !process.env.DATABASE_URL;

function localDb(): Local {
  if (g.__pglite) return g.__pglite;
  // require en vez de import: PGlite solo se carga en desarrollo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const client = new PGlite(process.env.PGLITE_DIR ?? ".pglite");
  const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as DB;
  const ready = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require("drizzle-orm/pglite/migrator") as typeof import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder: "drizzle" });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { seedIfEmpty } = require("./seed") as typeof import("./seed");
    await seedIfEmpty(db);
  })();
  g.__pglite = { db, exec: (s) => client.exec(s), ready };
  return g.__pglite;
}

function neonDb(): DB {
  if (!g.__neonDb) g.__neonDb = drizzleNeon(neon(process.env.DATABASE_URL!), { schema, casing: "snake_case" });
  return g.__neonDb;
}

export const db: DB = isLocalDb ? localDb().db : neonDb();

/** Espera a que la base local esté migrada y con datos (no hace nada con Neon). */
export async function dbReady() {
  if (isLocalDb) await localDb().ready;
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Ejecuta varias consultas como una sola unidad: todas o ninguna.
 * Con Neon usa db.batch (una transacción por HTTP); en local, BEGIN/COMMIT.
 */
export async function batch<T extends [BatchItem<"pg">, ...BatchItem<"pg">[]]>(queries: T) {
  if (!isLocalDb) return db.batch(queries);
  const local = localDb();
  await local.ready;
  const run = async () => {
    await local.exec("BEGIN");
    try {
      const out: unknown[] = [];
      for (const q of queries) out.push(await q);
      await local.exec("COMMIT");
      return out;
    } catch (e) {
      await local.exec("ROLLBACK");
      throw e;
    }
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p as Promise<BatchResponse<T>>;
}
