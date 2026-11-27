"use server";

import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, batch } from "@/db";
import { serviceCategories, serviceItems, settings, type Urgency } from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole } from "@/lib/auth-guard";
import { fail, invalid, UserError } from "@/lib/action-utils";
import { audit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { URGENCY_LABEL } from "@/lib/domain";

const done = () => revalidatePath("/", "layout");

/** RF-57: plazo (horas) y recargo (%) de un nivel. Normal siempre 0 %. Solo admin. */
export async function setUrgency(level: Urgency, hours: number, pct: number): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const h = z.number().int().min(1).max(24 * 60).parse(hours);
    const p = level === "normal" ? 0 : z.number().int().min(0).max(500).parse(pct);
    const s = await getSettings();
    const before = s.urgency[level];
    if (before.hours === h && before.pct === p) return { ok: true };
    const urgency = { ...s.urgency, [level]: { hours: h, pct: p } };
    await batch([
      db.update(settings).set({ urgency }).where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "1", action: "urgencia", summary: `cambió ${URGENCY_LABEL[level]}: ${before.hours} h +${before.pct} % → ${h} h +${p} %`, before, after: { hours: h, pct: p }, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-08: factor por ciclo (3 a 10; ciclo 1–2 queda ×1.00). «9–10» se guarda en los dos. */
export async function setCycleFactor(cycle: number, factor: number): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const c = z.number().int().min(3).max(10).parse(cycle);
    const f = Math.round(z.number().min(1).max(5).parse(factor) * 100) / 100;
    const s = await getSettings();
    const keys = c >= 9 ? ["9", "10"] : [String(c)];
    const before = s.cycleFactors[keys[0]];
    if (before === f) return { ok: true };
    const cycleFactors = { ...s.cycleFactors, ...Object.fromEntries(keys.map((k) => [k, f])) };
    await batch([
      db.update(settings).set({ cycleFactors }).where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "1", action: "factor", summary: `cambió el factor del ciclo ${c >= 9 ? "9–10" : c}: ×${before.toFixed(2)} → ×${f.toFixed(2)}`, before: { factor: before }, after: { factor: f }, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Precio base de un ítem del tarifario (casilla con flechas de S/ 5). No toca los trabajos ya registrados. */
export async function setItemPrice(itemId: string, price: number): Promise<ActionResult> {
  try {
    const me = await assertRole("admin");
    const p = z.number().min(0).max(100_000).parse(price);
    const it = await db.query.serviceItems.findFirst({ where: eq(serviceItems.id, itemId) });
    if (!it) throw new UserError("Ese ítem ya no existe.");
    if (it.basePrice === p) return { ok: true };
    await batch([
      db.update(serviceItems).set({ basePrice: p }).where(eq(serviceItems.id, itemId)),
      audit({ entity: "servicio", entityId: itemId, action: "precio", summary: `cambió el precio base de ${it.code} ${it.name}: S/ ${it.basePrice} → S/ ${p}`, before: { basePrice: it.basePrice }, after: { basePrice: p }, userId: me.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const itemSchema = z.object({
  categoryId: z.string().uuid("Elige la categoría"),
  name: z.string().trim().min(3, "Escribe el nombre").max(160),
  includes: z.string().trim().max(300).optional(),
  unit: z.string().trim().min(2, "Elige cómo se cobra").max(40),
  basePrice: z.number().min(0).max(100_000),
  hours: z.number().min(0).max(1000).nullable(),
  pricingMode: z.enum(["fijo", "ciclo"]),
});

/** Nuevo ítem del tarifario con código automático (PL-16). Solo admin. */
export async function createServiceItem(input: z.input<typeof itemSchema>): Promise<ActionResult<{ code: string }>> {
  try {
    const me = await assertRole("admin");
    const parsed = itemSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    const cat = await db.query.serviceCategories.findFirst({ where: eq(serviceCategories.id, v.categoryId) });
    if (!cat) throw new UserError("Esa categoría ya no existe.");
    if (cat.isCustom) throw new UserError("Personalizado tiene un solo ítem.");
    const existing = await db.select({ code: serviceItems.code, sortOrder: serviceItems.sortOrder }).from(serviceItems).where(eq(serviceItems.categoryId, cat.id)).orderBy(asc(serviceItems.sortOrder));
    const code = nextItemCode(cat.code, existing.map((e) => e.code));
    const id = crypto.randomUUID();
    await batch([
      db.insert(serviceItems).values({ id, categoryId: cat.id, code, name: v.name, includes: v.includes || null, unit: v.unit, basePrice: v.basePrice, hours: v.hours, pricingMode: v.pricingMode, starred: true, sortOrder: (existing.at(-1)?.sortOrder ?? 0) + 1 }),
      audit({ entity: "servicio", entityId: id, action: "crear", summary: `agregó al tarifario ${code} ${v.name} a S/ ${v.basePrice}`, after: v, userId: me.id }),
    ]);
    done();
    return { ok: true, data: { code } };
  } catch (e) {
    return fail(e);
  }
}

function nextItemCode(prefix: string, codes: string[]) {
  const max = codes.reduce((m, c) => Math.max(m, Number(c.split("-")[1]) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}
