/**
 * Da de alta el primer administrador en la lista de correos permitidos.
 * Uso: pnpm db:seed-admin tu-correo@gmail.com
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { allowedEmails } from "../src/db/schema";

const email = (process.argv[2] ?? process.env.ADMIN_EMAIL)?.toLowerCase().trim();
if (!email) {
  console.error("Indica un correo: pnpm db:seed-admin tu-correo@gmail.com");
  process.exit(1);
}

const db = drizzle(neon(process.env.DATABASE_URL!), { casing: "snake_case" });

await db
  .insert(allowedEmails)
  .values({ email, role: "admin", addedBy: "seed" })
  .onConflictDoUpdate({ target: allowedEmails.email, set: { role: "admin" } });

console.log(`✔ ${email} ahora es administrador.`);
