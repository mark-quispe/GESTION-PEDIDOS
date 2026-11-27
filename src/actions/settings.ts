"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, batch } from "@/db";
import { settings } from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail, invalid } from "@/lib/action-utils";
import { normalizePhone } from "@/lib/domain";
import { getSettings } from "@/lib/settings";

const done = () => revalidatePath("/", "layout");
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const studioSchema = z.object({
  studioName: z.string().trim().min(2, "Escribe el nombre").max(80),
  whatsapp: opt(20).transform((v) => (v ? normalizePhone(v) : null)),
  contactEmail: z.string().trim().max(120).email("Correo no válido").optional().or(z.literal("")).transform((v) => v || null),
  academicTerm: z
    .string()
    .trim()
    .regex(/^(\d{4}-(I|II))?$/, "Escribe el ciclo así: 2026-II")
    .optional()
    .transform((v) => v || null),
  instagram: opt(200),
  tiktok: opt(200),
  facebook: opt(200),
  /** Data URL de un logo pequeño (PNG, JPG, WEBP o SVG). */
  logoUrl: z
    .string()
    .max(200_000, "El logo pesa demasiado (máx. 150 KB)")
    .regex(/^(data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+)?$/, "Formato de logo no válido")
    .optional()
    .transform((v) => v || null),
});

/** RF-55 y RF-56: datos del estudio, logo y redes. */
export async function saveStudio(input: z.input<typeof studioSchema>): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const parsed = studioSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await batch([
      db.update(settings).set(parsed.data).where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "estudio", action: "editar", summary: "cambió los datos del estudio", after: { ...parsed.data, logoUrl: parsed.data.logoUrl ? "(logo)" : null }, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const alertsSchema = z.object({
  quoteDays: z.number().int().min(1).max(60),
  pendingDays: z.number().int().min(1).max(90),
  driveFullGb: z.number().min(1).max(2000),
  quoteOn: z.boolean(),
  pendingOn: z.boolean(),
  driveOn: z.boolean(),
  backupFailed: z.boolean(),
});

/** RF-56: cuándo avisar. Los avisos salen en el Inicio y en la tarjeta Sistema. */
export async function saveAlerts(input: z.input<typeof alertsSchema>): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const parsed = alertsSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const s = await getSettings();
    const alerts = { ...s.alerts, ...parsed.data };
    await batch([
      db.update(settings).set({ alerts }).where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "avisos", action: "editar", summary: "cambió cuándo avisar", before: s.alerts, after: alerts, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-32: pausar o reanudar el respaldo de cada noche. */
export async function setBackupEnabled(on: boolean): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    await batch([
      db.update(settings).set({ backupEnabled: on }).where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "respaldo", action: on ? "activar" : "pausar", summary: on ? "reanudó el respaldo diario" : "pausó el respaldo diario", userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
