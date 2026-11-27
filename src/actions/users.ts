"use server";

import { refresh } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { allowedEmails, users } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/action-utils";
import { allowedEmailSchema } from "@/lib/validation/users";
import type { ActionResult } from "./result";

/** RF-04: nunca puede quedar el sistema sin administrador. */
async function otherAdmins(email: string) {
  const [row] = await db
    .select({ n: count() })
    .from(allowedEmails)
    .where(and(eq(allowedEmails.role, "admin"), ne(allowedEmails.email, email)));
  return row.n;
}

export async function addAllowedEmail(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertRole("admin");
    const parsed = allowedEmailSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos" };
    return await saveAccess(parsed.data.email, parsed.data.role, admin);
  } catch (e) {
    return fail(e);
  }
}

export async function changeRole(email: string, role: "admin" | "empleado"): Promise<ActionResult> {
  try {
    const admin = await assertRole("admin");
    const parsed = allowedEmailSchema.parse({ email, role });
    return await saveAccess(parsed.email, parsed.role, admin);
  } catch (e) {
    return fail(e);
  }
}

async function saveAccess(email: string, role: "admin" | "empleado", admin: { id: string; email: string | null }): Promise<ActionResult> {
  const current = await db.query.allowedEmails.findFirst({ where: eq(allowedEmails.email, email) });
  if (current?.role === "admin" && role !== "admin" && (await otherAdmins(email)) === 0) {
    return { ok: false, error: "Es el último administrador: da el rol de admin a otra persona antes de quitárselo." };
  }
  await db.batch([
    db
      .insert(allowedEmails)
      .values({ email, role, addedBy: admin.email })
      .onConflictDoUpdate({ target: allowedEmails.email, set: { role } }),
    // Si ya había entrado antes, el cambio vale al instante.
    db.update(users).set({ role, active: 1 }).where(eq(users.email, email)),
    audit({ entity: "usuario", entityId: email, action: current ? "rol" : "dar_acceso", before: current?.role ?? null, after: role, userId: admin.id }),
  ]);
  refresh();
  return { ok: true };
}

export async function removeAllowedEmail(email: string): Promise<ActionResult> {
  try {
    const admin = await assertRole("admin");
    const target = z.email().parse(email);
    const current = await db.query.allowedEmails.findFirst({ where: eq(allowedEmails.email, target) });
    if (!current) return { ok: true };
    if (current.role === "admin" && (await otherAdmins(target)) === 0) {
      return { ok: false, error: "Es el último administrador: no se le puede quitar el acceso." };
    }
    await db.batch([
      db.delete(allowedEmails).where(eq(allowedEmails.email, target)),
      db.update(users).set({ active: 0 }).where(eq(users.email, target)),
      audit({ entity: "usuario", entityId: target, action: "quitar_acceso", before: current.role, userId: admin.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
