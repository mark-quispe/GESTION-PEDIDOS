import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, jobCounters, jobItems, jobs, serviceCategories, serviceItems } from "@/db/schema";
import { normalizeText } from "@/lib/domain";
import { getSettings } from "@/lib/settings";
import { yearLima } from "@/lib/dates";

export type ServiceRow = { id: string; code: string; name: string; includes: string | null; unit: string; hours: number | null; pricingMode: "fijo" | "ciclo"; basePrice: number };
export type ServiceCategory = { id: string; code: string; prefix: string; name: string; isCustom: boolean; items: ServiceRow[] };
export type CustomRequest = { key: string; text: string; price: number; jobCode: string; clientName: string; times: number };

/** Servicios = tarifario (RF-08, RF-57, RF-68): categorías, ítems, cintas y personalizados recientes. */
export async function getServices() {
  const year = yearLima();
  const [cats, items, s, counter, customs] = await Promise.all([
    db.select().from(serviceCategories).orderBy(asc(serviceCategories.isCustom), asc(serviceCategories.sortOrder)),
    db.select().from(serviceItems).where(eq(serviceItems.active, true)).orderBy(asc(serviceItems.sortOrder)),
    getSettings(),
    db.query.jobCounters.findFirst({ where: eq(jobCounters.year, year) }),
    db
      .select({ detail: jobItems.detail, name: jobItems.name, price: jobItems.basePrice, jobCode: jobs.code, clientName: clients.name, createdAt: jobItems.createdAt })
      .from(jobItems)
      .innerJoin(jobs, eq(jobs.id, jobItems.jobId))
      .innerJoin(clients, eq(clients.id, jobs.clientId))
      .where(and(eq(jobItems.categoryCode, "OT"), isNull(jobs.deletedAt)))
      .orderBy(desc(jobItems.createdAt))
      .limit(200),
  ]);

  const categories: ServiceCategory[] = cats.map((c) => ({
    id: c.id,
    code: c.code,
    prefix: c.prefix,
    name: c.name,
    isCustom: c.isCustom,
    items: items
      .filter((i) => i.categoryId === c.id)
      .map((i) => ({ id: i.id, code: i.code, name: i.name, includes: i.includes, unit: i.unit, hours: i.hours, pricingMode: i.pricingMode, basePrice: i.basePrice })),
  }));

  // Lo parecido se agrupa por el texto normalizado; se muestra el pedido más reciente de cada grupo.
  const groups = new Map<string, CustomRequest>();
  for (const c of customs) {
    const text = (c.detail || c.name).trim();
    const key = normalizeText(text).replace(/\s+/g, " ").slice(0, 60);
    const g = groups.get(key);
    if (g) g.times++;
    else groups.set(key, { key, text, price: c.price, jobCode: c.jobCode, clientName: c.clientName, times: 1 });
  }

  return {
    categories,
    urgency: s.urgency,
    cycleFactors: s.cycleFactors,
    nextSeq: Math.max((counter?.last ?? 0) + 1, s.codeStart),
    year,
    customs: [...groups.values()].slice(0, 8),
  };
}

export type ServicesData = Awaited<ReturnType<typeof getServices>>;
