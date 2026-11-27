"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db, batch } from "@/db";
import { clientObservations, clients } from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole } from "@/lib/auth-guard";
import { fail, invalid, UserError } from "@/lib/action-utils";
import { audit } from "@/lib/audit";
import { clientSchema, type ClientInput } from "@/lib/validation/clients";

const done = () => revalidatePath("/", "layout");
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));



/** RF-05 y RF-36: registrar al cliente; si el WhatsApp ya existe, se avisa y no se repite. */
export async function saveClient(input: ClientInput & { id?: string }): Promise<ActionResult<{ id: string; existing?: boolean }>> {
  try {
    const user = await assertRole();
    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    const dupe = await db.query.clients.findFirst({
      where: input.id ? and(eq(clients.whatsapp, v.whatsapp), ne(clients.id, input.id)) : eq(clients.whatsapp, v.whatsapp),
    });
    if (dupe) {
      if (dupe.deletedAt) throw new UserError(`Ese WhatsApp es de ${dupe.name}, que está en Eliminados. El admin puede restaurarlo.`);
      if (!input.id) return { ok: true, data: { id: dupe.id, existing: true } };
      throw new UserError(`Ese WhatsApp ya es de ${dupe.name}.`);
    }
    if (input.id) {
      const before = await db.query.clients.findFirst({ where: eq(clients.id, input.id) });
      if (!before || before.deletedAt) throw new UserError("Ese cliente ya no existe.");
      await batch([
        db.update(clients).set(v).where(eq(clients.id, input.id)),
        audit({ entity: "cliente", entityId: input.id, action: "editar", summary: `editó los datos de ${v.name}`, before, after: v, userId: user.id }),
      ]);
      done();
      return { ok: true, data: { id: input.id } };
    }
    const id = crypto.randomUUID();
    await batch([
      db.insert(clients).values({ id, ...v, createdById: user.id }),
      audit({ entity: "cliente", entityId: id, action: "crear", summary: `registró al cliente ${v.name}`, userId: user.id }),
    ]);
    done();
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

const prefsSchema = z.object({
  clientId: z.string().uuid(),
  software: opt(200),
  usualFormat: opt(200),
  requestedFiles: opt(120),
  otherPrefs: opt(600),
});

/** RF-38: preferencias que se llenan solas en cada trabajo nuevo. */
export async function savePreferences(input: z.input<typeof prefsSchema>): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const parsed = prefsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { clientId, ...v } = parsed.data;
    await batch([
      db.update(clients).set(v).where(eq(clients.id, clientId)),
      audit({ entity: "cliente", entityId: clientId, action: "editar", summary: "editó las preferencias", after: v, userId: user.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const obsSchema = z.object({
  clientId: z.string().uuid(),
  body: z.string().trim().min(3, "Escribe la observación").max(300),
  kind: z.enum(["pagos", "trato", "entregas", "archivos", "otro"]).optional().nullable(),
  alertOnNewJob: z.boolean().default(false),
});

/** RF-45: observación corta con fecha; quién la escribió solo lo ve el admin. */
export async function addObservation(input: z.input<typeof obsSchema>): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const parsed = obsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    await batch([
      db.insert(clientObservations).values({ ...v, authorId: user.id }),
      audit({ entity: "cliente", entityId: v.clientId, action: "observacion", summary: "agregó una observación", userId: user.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-29: eliminar es ocultar (solo admin). Se restaura desde Eliminados. */
export async function deleteClient(id: string, reason?: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const c = await db.query.clients.findFirst({ where: and(eq(clients.id, id), isNull(clients.deletedAt)) });
    if (!c) throw new UserError("Ese cliente ya no existe.");
    await batch([
      db.update(clients).set({ deletedAt: new Date(), deletedById: user.id }).where(eq(clients.id, id)),
      audit({ entity: "cliente", entityId: id, action: "eliminar", summary: `eliminó al cliente ${c.name}`, after: reason?.trim() ? { reason: reason.trim().slice(0, 200) } : null, userId: user.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
