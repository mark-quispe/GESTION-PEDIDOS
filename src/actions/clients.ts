"use server";

import { refresh } from "next/cache";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail, invalid } from "@/lib/action-utils";
import { normalizeWhatsapp } from "@/lib/domain";
import { clientSchema, type ClientInput } from "@/lib/validation/clients";
import type { ActionResult } from "./result";

type ExistingClient = { id: string; name: string; deleted: boolean };

async function findByWhatsapp(whatsapp: string): Promise<ExistingClient | null> {
  const c = await db.query.clients.findFirst({
    where: eq(clients.whatsapp, whatsapp),
    columns: { id: true, name: true, deletedAt: true },
  });
  return c ? { id: c.id, name: c.name, deleted: !!c.deletedAt } : null;
}

/** RF-36: al escribir el número se avisa si ya existe. */
export async function lookupWhatsapp(raw: string): Promise<ExistingClient | null> {
  await assertRole();
  const n = normalizeWhatsapp(raw);
  if (n.length < 9) return null;
  return findByWhatsapp(n);
}

/** RF-06: buscar por nombre o por número. */
export async function searchClients(query: string) {
  await assertRole();
  const q = query.trim();
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, "");
  const rows = await db
    .select({ id: clients.id, name: clients.name, whatsapp: clients.whatsapp, university: clients.university })
    .from(clients)
    .where(
      and(
        isNull(clients.deletedAt),
        or(ilike(clients.name, `%${q}%`), digits.length >= 3 ? ilike(clients.whatsapp, `%${digits}%`) : undefined),
      ),
    )
    .orderBy(clients.name)
    .limit(10);
  return rows;
}

export type SaveClientResult = ActionResult<{ id: string; existing?: ExistingClient }>;

export async function createClient(input: ClientInput): Promise<SaveClientResult> {
  try {
    const user = await assertRole();
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    // RF-36: no se crea otro cliente con el mismo WhatsApp; se usa el que ya está.
    const existing = await findByWhatsapp(parsed.data.whatsapp);
    if (existing) return { ok: true, data: { id: existing.id, existing } };

    const id = crypto.randomUUID();
    await db.batch([
      db.insert(clients).values({ id, ...parsed.data, createdById: user.id }),
      audit({ entity: "cliente", entityId: id, action: "crear", after: parsed.data, userId: user.id }),
    ]);
    refresh();
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateClient(id: string, input: ClientInput): Promise<SaveClientResult> {
  try {
    const user = await assertRole();
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const current = await db.query.clients.findFirst({ where: and(eq(clients.id, z.uuid().parse(id)), isNull(clients.deletedAt)) });
    if (!current) return { ok: false, error: "El cliente no existe o fue eliminado." };
    if (parsed.data.whatsapp !== current.whatsapp) {
      const existing = await findByWhatsapp(parsed.data.whatsapp);
      if (existing) return { ok: false, error: `Ese WhatsApp ya es de ${existing.name}${existing.deleted ? " (eliminado)" : ""}.`, fieldErrors: { whatsapp: ["Ya registrado"] } };
    }
    const before = Object.fromEntries(Object.keys(parsed.data).map((k) => [k, current[k as keyof typeof current]]));
    await db.batch([
      db.update(clients).set(parsed.data).where(eq(clients.id, id)),
      audit({ entity: "cliente", entityId: id, action: "editar", before, after: parsed.data, userId: user.id }),
    ]);
    refresh();
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

/** RF-45: observaciones, editables por los dos roles desde la ficha. */
export async function saveObservations(id: string, text: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const value = z.string().trim().max(2000).parse(text) || null;
    const current = await db.query.clients.findFirst({ where: eq(clients.id, z.uuid().parse(id)), columns: { observations: true } });
    if (!current) return { ok: false, error: "El cliente no existe." };
    await db.batch([
      db.update(clients).set({ observations: value }).where(eq(clients.id, id)),
      audit({ entity: "cliente", entityId: id, action: "observaciones", before: current.observations, after: value, userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-29: solo se marca como eliminado. */
export async function deleteClient(id: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    await db.batch([
      db.update(clients).set({ deletedAt: new Date(), deletedById: user.id }).where(eq(clients.id, z.uuid().parse(id))),
      audit({ entity: "cliente", entityId: id, action: "eliminar", userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function restoreClient(id: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    await db.batch([
      db.update(clients).set({ deletedAt: null, deletedById: null }).where(eq(clients.id, z.uuid().parse(id))),
      audit({ entity: "cliente", entityId: id, action: "restaurar", userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
