"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, batch } from "@/db";
import { externos, users, type Role } from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole } from "@/lib/auth-guard";
import { fail, invalid, UserError } from "@/lib/action-utils";
import { audit } from "@/lib/audit";
import { rolesLabel } from "@/lib/domain";

const done = () => revalidatePath("/", "layout");

const rolesSchema = z.array(z.enum(["admin", "empleado", "produccion"])).min(1, "Elige al menos un rol");

/** Admin ya incluye todo: se guarda solo "admin". */
function normalize(roles: Role[]): Role[] {
  return roles.includes("admin") ? ["admin"] : [...new Set(roles)];
}

async function otherActiveAdmins(exceptId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.active, true), ne(users.id, exceptId), sql`'admin' = any(${users.roles})`));
  return n;
}

const grantSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Escribe un correo válido"),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  roles: rolesSchema,
});

/** RF-04: dar acceso a un Gmail con uno o varios roles. */
export async function grantAccess(input: z.input<typeof grantSchema>): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const parsed = grantSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    const roles = normalize(v.roles);
    const existing = await db.query.users.findFirst({ where: eq(users.email, v.email) });
    const name = v.name || existing?.name || v.email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (existing) {
      if (existing.active) throw new UserError("Ese correo ya tiene acceso.");
      await batch([
        db.update(users).set({ active: true, roles, name, phone: v.phone || existing.phone }).where(eq(users.id, existing.id)),
        audit({ entity: "usuario", entityId: existing.id, action: "acceso", summary: `devolvió el acceso a ${v.email} como ${rolesLabel(roles)}`, userId: me.id }),
      ]);
    } else {
      const id = crypto.randomUUID();
      await batch([
        db.insert(users).values({ id, email: v.email, name, phone: v.phone || null, roles }),
        audit({ entity: "usuario", entityId: id, action: "acceso", summary: `dio acceso a ${v.email} como ${rolesLabel(roles)}`, userId: me.id }),
      ]);
    }
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-04: cambiar roles. Nunca deja la app sin administrador. */
export async function setRoles(userId: string, rolesIn: Role[]): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const roles = normalize(rolesSchema.parse(rolesIn));
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!u) throw new UserError("Ese usuario ya no existe.");
    if (u.roles.includes("admin") && !roles.includes("admin") && (await otherActiveAdmins(u.id)) === 0) throw new UserError("Es el último administrador: no se le puede quitar el rol.");
    await batch([
      db.update(users).set({ roles }).where(eq(users.id, userId)),
      audit({ entity: "usuario", entityId: userId, action: "roles", summary: `cambió los roles de ${u.name}: ${rolesLabel(u.roles)} → ${rolesLabel(roles)}`, before: { roles: u.roles }, after: { roles }, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-04: quitar el acceso (botón que se mantiene 2 s). No borra nada. */
export async function revokeAccess(userId: string): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!u || !u.active) throw new UserError("Ese usuario ya no tiene acceso.");
    if (u.roles.includes("admin") && (await otherActiveAdmins(u.id)) === 0) throw new UserError("Es el último administrador: no se le puede quitar el acceso.");
    await batch([
      db.update(users).set({ active: false }).where(eq(users.id, userId)),
      audit({ entity: "usuario", entityId: userId, action: "acceso", summary: `quitó el acceso a ${u.email}`, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const externoSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(120),
  phone: z.string().trim().max(20).optional(),
  note: z.string().trim().max(500).optional(),
  skills: z.array(z.string().max(12)).max(40).default([]),
});

/** RF-18: externo sin acceso a la app. Lo puede crear cualquier rol (tabla 2.1). */
export async function createExterno(input: z.input<typeof externoSchema>): Promise<ActionResult> {
  try {
    const me = await assertRole();
    const parsed = externoSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const id = crypto.randomUUID();
    await batch([
      db.insert(externos).values({ id, name: parsed.data.name, phone: parsed.data.phone || null, note: parsed.data.note || null, skills: parsed.data.skills, createdById: me.id }),
      audit({ entity: "externo", entityId: id, action: "crear", summary: `agregó al externo ${parsed.data.name}`, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-18: editar un externo (nombre, celular, nota y qué hace). Solo admin. */
export async function updateExterno(id: string, input: z.input<typeof externoSchema>): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const parsed = externoSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const e = await db.query.externos.findFirst({ where: eq(externos.id, id) });
    if (!e) throw new UserError("Ese externo ya no existe.");
    const v = parsed.data;
    await batch([
      db.update(externos).set({ name: v.name, phone: v.phone || null, note: v.note || null, skills: v.skills }).where(eq(externos.id, id)),
      audit({ entity: "externo", entityId: id, action: "editar", summary: `editó al externo ${v.name}`, before: { name: e.name, phone: e.phone, skills: e.skills }, after: { name: v.name, phone: v.phone, skills: v.skills }, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-18: activo = aparece al encargar trabajos. Sus trabajos pasados se quedan con su nombre. */
export async function setExternoActive(id: string, active: boolean): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const e = await db.query.externos.findFirst({ where: eq(externos.id, id) });
    if (!e) throw new UserError("Ese externo ya no existe.");
    await batch([
      db.update(externos).set({ active }).where(eq(externos.id, id)),
      audit({ entity: "externo", entityId: id, action: active ? "activar" : "desactivar", summary: `${active ? "activó" : "desactivó"} al externo ${e.name}`, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
