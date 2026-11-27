import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { externos, jobItems, jobs, serviceCategories, serviceItems, users } from "@/db/schema";
import { addDays, monthStart, startOfDayLima, todayLima, weekStart } from "@/lib/dates";

export type ProdPeriod = "semana" | "mes" | "3m" | "ano";

export type ProdPerson = {
  key: string;
  id: string;
  kind: "usuario" | "externo";
  name: string;
  phone: string | null;
  isAdmin: boolean;
  active: boolean;
  note: string | null;
  /** Códigos del tarifario (solo externos). */
  skills: string[];
  inProgress: number;
};

export type DoneItem = { id: string; name: string; code: string; jobCode: string; category: string; hours: number; doneAt: string; who: string };

/** Desde qué día cuenta cada periodo (calendario de Lima). */
export function periodFrom(p: ProdPeriod, today = todayLima()) {
  if (p === "semana") return weekStart(today);
  if (p === "mes") return monthStart(today);
  if (p === "3m") return monthStart(addDays(monthStart(addDays(monthStart(today), -1)), -1));
  return `${today.slice(0, 4)}-01-01`;
}

/** RF-18: la gente de Producción (equipo con rol Producción o admin, y externos) y los ítems que marcó como hechos. */
export async function getProduction() {
  const today = todayLima();
  const since = [periodFrom("3m", today), periodFrom("ano", today)].sort()[0];

  const [people, exts, open, done, catalog] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)),
    db.select().from(externos).orderBy(asc(externos.name)),
    db
      .select({ responsibleId: jobs.responsibleId, externoId: jobs.externoId })
      .from(jobs)
      .where(and(isNull(jobs.deletedAt), inArray(jobs.status, ["en_proceso", "correcciones"]))),
    db
      .select({
        id: jobItems.id,
        name: jobItems.name,
        code: jobItems.code,
        jobCode: jobs.code,
        category: serviceCategories.name,
        hours: jobItems.hours,
        doneAt: jobItems.doneAt,
        doneById: jobItems.doneById,
        doneByExternoId: jobItems.doneByExternoId,
      })
      .from(jobItems)
      .innerJoin(jobs, eq(jobs.id, jobItems.jobId))
      .leftJoin(serviceCategories, eq(serviceCategories.code, jobItems.categoryCode))
      .where(and(isNull(jobs.deletedAt), isNotNull(jobItems.doneAt), gte(jobItems.doneAt, startOfDayLima(since)))),
    db.select({ code: serviceItems.code, name: serviceItems.name }).from(serviceItems),
  ]);

  const team: ProdPerson[] = people
    .filter((u) => u.roles.includes("produccion") || u.roles.includes("admin"))
    .map((u) => ({
      key: `u:${u.id}`,
      id: u.id,
      kind: "usuario",
      name: u.name,
      phone: u.phone,
      isAdmin: u.roles.includes("admin"),
      active: u.active,
      note: null,
      skills: [],
      inProgress: open.filter((j) => j.responsibleId === u.id && !j.externoId).length,
    }));
  const outside: ProdPerson[] = exts.map((e) => ({
    key: `e:${e.id}`,
    id: e.id,
    kind: "externo",
    name: e.name,
    phone: e.phone,
    isAdmin: false,
    active: e.active,
    note: e.note,
    skills: e.skills,
    inProgress: open.filter((j) => j.externoId === e.id).length,
  }));

  const items: DoneItem[] = done.map((i) => ({
    id: i.id,
    name: i.name,
    code: i.code,
    jobCode: i.jobCode,
    category: i.category ?? i.code.slice(0, 2),
    hours: i.hours,
    doneAt: i.doneAt!.toISOString(),
    who: i.doneByExternoId ? `e:${i.doneByExternoId}` : `u:${i.doneById}`,
  }));

  return {
    people: [...team, ...outside],
    items,
    itemNames: Object.fromEntries(catalog.map((c) => [c.code, c.name])) as Record<string, string>,
    from: { semana: periodFrom("semana", today), mes: periodFrom("mes", today), "3m": periodFrom("3m", today), ano: periodFrom("ano", today) } as Record<ProdPeriod, string>,
    monthName: new Intl.DateTimeFormat("es-PE", { month: "long", timeZone: "America/Lima" }).format(new Date()).toLowerCase(),
    year: today.slice(0, 4),
  };
}

export type ProductionData = Awaited<ReturnType<typeof getProduction>>;
