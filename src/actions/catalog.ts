"use server";

import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { responsables, serviceTypes, settings } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail, invalid } from "@/lib/action-utils";
import { getSettings } from "@/lib/drive";
import { codeStartSchema, responsableSchema, serviceTypeSchema } from "@/lib/validation/catalog";
import type { ActionResult } from "./result";

/** RF-08: el admin define los tipos de servicio y su prefijo. */
export async function saveServiceType(input: z.input<typeof serviceTypeSchema>): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const parsed = serviceTypeSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;
    const clash = await db.query.serviceTypes.findFirst({ where: eq(serviceTypes.prefix, data.prefix) });
    if (clash && clash.id !== id) return { ok: false, error: `El prefijo ${data.prefix} ya es de "${clash.name}".`, fieldErrors: { prefix: ["En uso"] } };
    if (id) {
      const before = await db.query.serviceTypes.findFirst({ where: eq(serviceTypes.id, id) });
      await db.batch([
        db.update(serviceTypes).set(data).where(eq(serviceTypes.id, id)),
        audit({ entity: "servicio", entityId: id, action: "editar", before, after: data, userId: user.id }),
      ]);
    } else {
      const newId = crypto.randomUUID();
      await db.batch([
        db.insert(serviceTypes).values({ id: newId, ...data }),
        audit({ entity: "servicio", entityId: newId, action: "crear", after: data, userId: user.id }),
      ]);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleServiceType(id: string, active: boolean): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    await db.batch([
      db.update(serviceTypes).set({ active }).where(eq(serviceTypes.id, z.uuid().parse(id))),
      audit({ entity: "servicio", entityId: id, action: active ? "activar" : "desactivar", userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-18 */
export async function saveResponsable(input: z.input<typeof responsableSchema>): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const parsed = responsableSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;
    if (id) {
      await db.batch([
        db.update(responsables).set(data).where(eq(responsables.id, id)),
        audit({ entity: "responsable", entityId: id, action: "editar", after: data, userId: user.id }),
      ]);
    } else {
      const newId = crypto.randomUUID();
      await db.batch([
        db.insert(responsables).values({ id: newId, ...data }),
        audit({ entity: "responsable", entityId: newId, action: "crear", after: data, userId: user.id }),
      ]);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleResponsable(id: string, active: boolean): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    await db.batch([
      db.update(responsables).set({ active }).where(eq(responsables.id, z.uuid().parse(id))),
      audit({ entity: "responsable", entityId: id, action: active ? "activar" : "desactivar", userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-08: el correlativo puede empezar en 100 para no revelar el volumen. */
export async function saveCodeStart(input: { codeStart: string }): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const parsed = codeStartSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const before = await getSettings();
    await db.batch([
      db.update(settings).set({ codeStart: parsed.data.codeStart }).where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "codeStart", action: "editar", before: before.codeStart, after: parsed.data.codeStart, userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
