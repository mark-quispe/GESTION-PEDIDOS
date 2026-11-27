import "server-only";
import { and, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, clients, externos, jobCorrections, jobItems, jobs, payments, serviceCategories, users, type PaymentMethod, type Urgency } from "@/db/schema";
import { addDays, dayKey, startOfDayLima, todayLima, weekStart } from "@/lib/dates";
import { METHODS, paidNet, round2 } from "@/lib/domain";

export type StatsPeriod = "1s" | "4s" | "12s" | "todo";
export const PERIOD_LABEL: Record<StatsPeriod, string> = { "1s": "1 semana", "4s": "4 semanas", "12s": "12 semanas", todo: "Todo" };

type Bucket = { key: string; label: string; from: string; to: string };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const lbl = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

/**
 * RF-51: todos los números de Estadísticas para el periodo elegido, con la
 * comparación contra el periodo anterior equivalente. Con 1 semana, todo por día.
 */
export async function getStats(period: StatsPeriod) {
  const today = todayLima();
  const thisWeek = weekStart(today);
  const allJobs = await db
    .select({
      id: jobs.id,
      code: jobs.code,
      clientId: jobs.clientId,
      clientName: clients.name,
      status: jobs.status,
      urgency: jobs.urgency,
      urgencyPct: jobs.urgencyPct,
      price: jobs.price,
      cycle: jobs.cycle,
      createdAt: jobs.createdAt,
      takenAt: jobs.takenAt,
      dueAt: jobs.dueAt,
      sentAt: jobs.sentAt,
      finishedAt: jobs.finishedAt,
      cancelledAt: jobs.cancelledAt,
      cancelReason: jobs.cancelReason,
      externoId: jobs.externoId,
      responsibleId: jobs.responsibleId,
    })
    .from(jobs)
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .where(isNull(jobs.deletedAt));

  const firstDay = allJobs.length ? dayKey(allJobs.reduce((m, j) => (j.createdAt < m ? j.createdAt : m), allJobs[0].createdAt)) : today;
  const weeks = period === "1s" ? 1 : period === "4s" ? 4 : period === "12s" ? 12 : Math.max(1, Math.ceil((new Date(today).getTime() - new Date(weekStart(firstDay)).getTime()) / (7 * 86_400_000)) + 1);
  const from = period === "1s" ? addDays(today, -6) : addDays(thisWeek, -7 * (weeks - 1));
  const to = addDays(today, 1);
  const prevFrom = addDays(from, -(weeks * 7));
  const byDay = period === "1s";

  const buckets: Bucket[] = byDay
    ? Array.from({ length: 7 }, (_, i) => {
        const d = addDays(from, i);
        return { key: d, label: WEEKDAYS[(new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7], from: d, to: addDays(d, 1) };
      })
    : Array.from({ length: weeks }, (_, i) => {
        const d = addDays(from, i * 7);
        return { key: d, label: lbl(d), from: d, to: addDays(d, 7) };
      });
  const bucketOf = (d: Date | string) => {
    const k = dayKey(d);
    return buckets.findIndex((b) => k >= b.from && k < b.to);
  };
  const inP = (d: Date | null | undefined) => !!d && dayKey(d) >= from && dayKey(d) < to;
  const inPrev = (d: Date | null | undefined) => !!d && dayKey(d) >= prevFrom && dayKey(d) < from;

  const ids = allJobs.map((j) => j.id);
  const [pays, items, corr, audits, people, cats, exts] = await Promise.all([
    ids.length ? db.select().from(payments).where(and(inArray(payments.jobId, ids), isNull(payments.deletedAt))) : [],
    ids.length ? db.select().from(jobItems).where(inArray(jobItems.jobId, ids)) : [],
    ids.length ? db.select().from(jobCorrections).where(inArray(jobCorrections.jobId, ids)) : [],
    db
      .select({ action: auditLog.action, userId: auditLog.userId, jobId: auditLog.jobId, createdAt: auditLog.createdAt, before: auditLog.before, after: auditLog.after, summary: auditLog.summary })
      .from(auditLog)
      .where(and(inArray(auditLog.action, ["tomar", "soltar", "precio"]), gte(auditLog.createdAt, startOfDayLima(prevFrom)))),
    db.select({ id: users.id, name: users.name, roles: users.roles }).from(users),
    db.select().from(serviceCategories),
    db.select({ id: externos.id, name: externos.name }).from(externos),
  ]);
  const catName = new Map(cats.map((c) => [c.code, c.name]));
  const personName = new Map([...people.map((p) => [p.id, p.name] as const), ...exts.map((e) => [e.id, e.name] as const)]);
  const jobById = new Map(allJobs.map((j) => [j.id, j]));

  /* ---------- Dinero ---------- */
  const signed = (p: (typeof pays)[number]) => (p.kind === "devolucion" ? -p.amount : p.amount);
  const live = pays.filter((p) => !p.voidedAt);
  const incomeIn = live.filter((p) => inP(p.paidAt));
  const income = round2(incomeIn.reduce((a, p) => a + signed(p), 0));
  const incomePrev = round2(live.filter((p) => inP(p.paidAt) === false && inPrev(p.paidAt)).reduce((a, p) => a + signed(p), 0));
  const incomeThisWeek = round2(live.filter((p) => dayKey(p.paidAt) >= thisWeek).reduce((a, p) => a + signed(p), 0));
  const incomeSeries = buckets.map((b, i) => ({ label: b.label, value: round2(incomeIn.filter((p) => bucketOf(p.paidAt) === i).reduce((a, p) => a + signed(p), 0)) }));

  const methods = METHODS.map((m) => {
    const ps = incomeIn.filter((p) => p.method === m && p.kind === "pago");
    const total = round2(ps.reduce((a, p) => a + p.amount, 0));
    return { method: m as PaymentMethod, total, count: ps.length, avg: ps.length ? round2(total / ps.length) : 0 };
  });
  const methodsTotal = methods.reduce((a, m) => a + m.total, 0) || 1;
  const unreviewed = incomeIn.filter((p) => !p.reviewedAt).length;

  /* ---------- Trabajos ---------- */
  const finished = allJobs.filter((j) => j.status === "finalizado" && inP(j.finishedAt));
  const finishedPrev = allJobs.filter((j) => j.status === "finalizado" && inPrev(j.finishedAt));
  const avgPrice = finished.length ? round2(finished.reduce((a, j) => a + j.price, 0) / finished.length) : 0;
  const leadDays = (js: typeof allJobs) => (js.length ? round2(js.reduce((a, j) => a + (j.finishedAt!.getTime() - j.createdAt.getTime()) / 86_400_000, 0) / js.length) : 0);
  const created = allJobs.filter((j) => inP(j.createdAt));
  const createdPrev = allJobs.filter((j) => inPrev(j.createdAt));
  const quotesWon = created.filter((j) => !["cotizacion", "cancelado"].includes(j.status)).length;
  const quotesOpen = created.filter((j) => j.status === "cotizacion").length;
  const quotesLost = created.filter((j) => j.status === "cancelado").length;
  const conversion = created.length ? Math.round((quotesWon / created.length) * 100) : 0;
  const quoteSeries = buckets.map((b, i) => ({ label: b.label, value: created.filter((j) => bucketOf(j.createdAt) === i && !["cotizacion", "cancelado"].includes(j.status)).length }));

  const weekdays = WEEKDAYS.map((d, i) => ({ label: d, value: created.filter((j) => (new Date(dayKey(j.createdAt) + "T12:00:00Z").getUTCDay() + 6) % 7 === i).length }));

  // Tiempo de entrega por categoría (del primer ítem).
  const firstCat = new Map<string, string>();
  for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) if (!firstCat.has(it.jobId)) firstCat.set(it.jobId, it.categoryCode);
  const leadByCat = new Map<string, number[]>();
  for (const j of finished) {
    const c = firstCat.get(j.id);
    if (!c) continue;
    leadByCat.set(c, [...(leadByCat.get(c) ?? []), (j.finishedAt!.getTime() - j.createdAt.getTime()) / 86_400_000]);
  }
  const leadCats = [...leadByCat.entries()]
    .map(([c, xs]) => ({ label: catName.get(c) ?? c, value: round2(xs.reduce((a, x) => a + x, 0) / xs.length) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  /* ---------- Equipo ---------- */
  const taken = audits.filter((a) => a.action === "tomar");
  const released = audits.filter((a) => a.action === "soltar");
  const doneItems = items.filter((i) => inP(i.doneAt));
  const team = [
    ...people
      .filter((p) => p.roles.includes("produccion") || p.roles.includes("admin"))
      .map((p) => {
        const t = taken.filter((a) => a.userId === p.id && inP(a.createdAt));
        const its = doneItems.filter((i) => i.doneById === p.id);
        return {
          id: p.id,
          name: p.name,
          role: p.roles.includes("admin") ? "Admin" : "Producción",
          ext: false,
          taken: t.length,
          takenPrev: taken.filter((a) => a.userId === p.id && inPrev(a.createdAt)).length,
          items: its.length,
          hours: round2(its.reduce((a, i) => a + i.hours, 0)),
          released: released.filter((a) => a.userId === p.id && inP(a.createdAt)).length,
          series: buckets.map((_, i) => t.filter((a) => bucketOf(a.createdAt) === i).length),
        };
      }),
    ...exts.map((e) => {
      const js = allJobs.filter((j) => j.externoId === e.id && inP(j.takenAt ?? j.createdAt));
      const its = doneItems.filter((i) => i.doneByExternoId === e.id);
      return {
        id: e.id,
        name: e.name,
        role: "Externo · encargado",
        ext: true,
        taken: js.length,
        takenPrev: 0,
        items: its.length,
        hours: round2(its.reduce((a, i) => a + i.hours, 0)),
        released: 0,
        series: buckets.map((_, i) => js.filter((j) => bucketOf(j.takenAt ?? j.createdAt) === i).length),
      };
    }),
  ]
    .filter((p) => p.taken > 0 || p.items > 0 || !p.ext)
    .sort((a, b) => b.taken - a.taken || b.hours - a.hours);

  /* ---------- Servicios ---------- */
  const itemsIn = items.filter((i) => inP(jobById.get(i.jobId)?.createdAt) && jobById.get(i.jobId)?.status !== "cancelado");
  const itemsPrev = items.filter((i) => inPrev(jobById.get(i.jobId)?.createdAt) && jobById.get(i.jobId)?.status !== "cancelado");
  const countBy = (xs: typeof items) => {
    const m = new Map<string, { code: string; name: string; times: number; amount: number }>();
    for (const i of xs) {
      const k = i.categoryCode === "OT" ? "OT-01" : i.code;
      const cur = m.get(k) ?? { code: k, name: i.categoryCode === "OT" ? "Personalizado" : i.name, times: 0, amount: 0 };
      cur.times += i.quantity;
      cur.amount += i.amount;
      m.set(k, cur);
    }
    return m;
  };
  const cur = countBy(itemsIn);
  const prev = countBy(itemsPrev);
  const topItems = [...cur.values()]
    .sort((a, b) => b.times - a.times)
    .slice(0, 10)
    .map((x) => ({ ...x, amount: round2(x.amount), delta: x.times - (prev.get(x.code)?.times ?? 0) }));

  // Pedidos por categoría y ciclo de la carrera.
  const cycleCats = new Map<string, number[]>();
  for (const j of created) {
    const c = firstCat.get(j.id);
    if (!c || !j.cycle) continue;
    const name = catName.get(c) ?? c;
    const row = cycleCats.get(name) ?? Array(10).fill(0);
    row[j.cycle - 1]++;
    cycleCats.set(name, row);
  }
  const byCycle = [...cycleCats.entries()].map(([label, values]) => ({ label, values })).sort((a, b) => b.values.reduce((x, y) => x + y, 0) - a.values.reduce((x, y) => x + y, 0)).slice(0, 7);

  // Se piden juntos: de cada 100 que piden A, cuántos piden también B.
  const codesByJob = new Map<string, Set<string>>();
  for (const i of itemsIn) codesByJob.set(i.jobId, (codesByJob.get(i.jobId) ?? new Set()).add(i.code));
  const single = new Map<string, number>();
  const pair = new Map<string, number>();
  for (const set of codesByJob.values()) {
    const arr = [...set];
    for (const a of arr) single.set(a, (single.get(a) ?? 0) + 1);
    for (const a of arr) for (const b of arr) if (a !== b) pair.set(`${a}|${b}`, (pair.get(`${a}|${b}`) ?? 0) + 1);
  }
  const nameOf = (code: string) => items.find((i) => i.code === code)?.name ?? code;
  const together = [...pair.entries()]
    .map(([k, n]) => {
      const [a, b] = k.split("|");
      return { a, b, aName: nameOf(a), bName: nameOf(b), pct: Math.round((n / (single.get(a) ?? 1)) * 100), n };
    })
    .filter((x) => x.n >= 2 && x.a < x.b)
    .sort((a, b) => b.pct - a.pct || b.n - a.n)
    .slice(0, 5);

  /* ---------- Clientes, pagos y entregas ---------- */
  const tookJobs = allJobs.filter((j) => j.takenAt && inP(j.takenAt) && !j.externoId);
  const takeHours = (js: typeof allJobs) => (js.length ? round2(js.reduce((a, j) => a + (j.takenAt!.getTime() - j.createdAt.getTime()) / 3_600_000, 0) / js.length) : 0);
  const takeByUrgency = (["urgente", "alta", "normal"] as Urgency[]).map((u) => ({ urgency: u, hours: takeHours(tookJobs.filter((j) => j.urgency === u)) }));
  const takeSeries = buckets.map((_, i) => ({ value: takeHours(tookJobs.filter((j) => bucketOf(j.takenAt!) === i)) }));
  const waitedLong = tookJobs.filter((j) => j.takenAt!.getTime() - j.createdAt.getTime() > 24 * 3_600_000).length;

  const topClients = [...created.reduce((m, j) => m.set(j.clientName, (m.get(j.clientName) ?? 0) + 1), new Map<string, number>()).entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const deliveredAt = (j: (typeof allJobs)[number]) => j.sentAt ?? j.finishedAt;
  const onTimeSeries = buckets.map((_, i) => {
    const js = finished.filter((j) => bucketOf(j.finishedAt!) === i);
    return { value: js.length ? Math.round((js.filter((j) => deliveredAt(j)! <= j.dueAt).length / js.length) * 100) : null };
  });
  const lateCount = finished.filter((j) => deliveredAt(j)! > j.dueAt).length;
  const onTime = finished.length ? Math.round(((finished.length - lateCount) / finished.length) * 100) : 0;

  const urgency = (["normal", "alta", "urgente"] as Urgency[]).map((u) => {
    const js = created.filter((j) => j.urgency === u && j.status !== "cancelado");
    return { urgency: u, count: js.length, surcharge: round2(js.reduce((a, j) => a + (j.urgencyPct ? j.price - j.price / (1 + j.urgencyPct / 100) : 0), 0)) };
  });
  const loweredUrgency = audits.filter((a) => a.action === "precio" && inP(a.createdAt) && (a.summary ?? "").includes("urgencia Urgente →")).length;

  const pendingAge = [
    { label: "0 a 3 días", min: 0, max: 3 },
    { label: "4 a 7 días", min: 4, max: 7 },
    { label: "8 a 15 días", min: 8, max: 15 },
    { label: "Más de 15", min: 16, max: 99_999 },
  ].map((b) => ({ ...b, warn: b.min > 3, total: 0, count: 0 }));
  for (const j of allJobs.filter((x) => x.status === "finalizado")) {
    const extras = 0;
    const pend = round2(j.price + extras - paidNet(pays.filter((p) => p.jobId === j.id)));
    if (pend <= 0.004) continue;
    const age = Math.floor((Date.now() - j.finishedAt!.getTime()) / 86_400_000);
    const b = pendingAge.find((x) => age >= x.min && age <= x.max)!;
    b.total = round2(b.total + pend);
    b.count++;
  }

  const firstJob = new Map<string, Date>();
  for (const j of allJobs) if (!firstJob.has(j.clientId) || j.createdAt < firstJob.get(j.clientId)!) firstJob.set(j.clientId, j.createdAt);
  const newVsReturning = buckets.map((b, i) => {
    const js = created.filter((j) => bucketOf(j.createdAt) === i);
    const fresh = js.filter((j) => firstJob.get(j.clientId)!.getTime() === j.createdAt.getTime()).length;
    return { label: b.label, fresh, back: js.length - fresh };
  });
  const backTotal = newVsReturning.reduce((a, x) => a + x.back, 0);
  const allTotal = newVsReturning.reduce((a, x) => a + x.back + x.fresh, 0);

  /* ---------- Dinero y correcciones ---------- */
  const received = round2(pays.filter((p) => p.kind === "pago" && inP(p.paidAt)).reduce((a, p) => a + p.amount, 0));
  const refunds = round2(pays.filter((p) => p.kind === "devolucion" && !p.voidedAt && inP(p.paidAt)).reduce((a, p) => a + p.amount, 0));
  const voided = round2(pays.filter((p) => p.kind === "pago" && p.voidedAt && inP(p.paidAt)).reduce((a, p) => a + p.amount, 0));
  const extrasPaid = round2(pays.filter((p) => p.correctionId && !p.voidedAt && inP(p.paidAt)).reduce((a, p) => a + p.amount, 0));

  const cancelled = allJobs.filter((j) => j.status === "cancelado" && inP(j.cancelledAt));
  const cancelReasons = ["No pagó el adelanto", "Pagó y desapareció", "El cliente lo canceló", "Canceló el trabajo", "Otro"]
    .map((r) => {
      const js = cancelled.filter((j) => (j.cancelReason ?? "Otro") === r);
      return { label: r, count: js.length, kept: round2(js.reduce((a, j) => a + paidNet(pays.filter((p) => p.jobId === j.id)), 0)) };
    })
    .filter((r) => r.count > 0);

  const corrIn = corr.filter((c) => inP(c.createdAt));
  const correctionSeries = buckets.map((b, i) => {
    const cs = corrIn.filter((c) => bucketOf(c.createdAt) === i);
    return { label: b.label, incl: cs.filter((c) => c.charge === "incluida").length, paid: cs.filter((c) => c.charge === "se_cobra" || c.charge === "extra").length, error: cs.filter((c) => c.charge === "error_estudio").length };
  });

  const priceAudits = audits.filter((a) => a.action === "precio" && inP(a.createdAt));
  let down = 0;
  let up = 0;
  const lowered = new Map<string, { count: number; amount: number }>();
  for (const a of priceAudits) {
    const b = (a.before as { price?: number } | null)?.price ?? 0;
    const af = (a.after as { price?: number } | null)?.price ?? 0;
    if (af < b) {
      down += b - af;
      const n = personName.get(a.userId ?? "") ?? "—";
      const cur2 = lowered.get(n) ?? { count: 0, amount: 0 };
      lowered.set(n, { count: cur2.count + 1, amount: round2(cur2.amount + b - af) });
    } else up += af - b;
  }

  return {
    period,
    from,
    to: addDays(to, -1),
    byDay,
    keys: {
      income,
      incomePrev,
      incomeThisWeek,
      finished: finished.length,
      finishedPrev: finishedPrev.length,
      perWeek: round2(finished.length / weeks),
      avgPrice,
      conversion,
      quotesWon,
      quotesTotal: created.length,
      leadDays: leadDays(finished),
      leadDaysPrev: leadDays(finishedPrev),
      createdPrev: createdPrev.length,
    },
    incomeSeries,
    methods: methods.map((m) => ({ ...m, pct: Math.round((m.total / methodsTotal) * 100) })),
    unreviewed,
    weekdays,
    leadCats,
    quotes: { won: quotesWon, open: quotesOpen, lost: quotesLost, series: quoteSeries },
    team,
    topItems,
    byCycle,
    together,
    take: { avg: takeHours(tookJobs), byUrgency: takeByUrgency, series: takeSeries, waitedLong },
    topClients,
    onTime: { pct: onTime, late: lateCount, series: onTimeSeries },
    urgency,
    loweredUrgency,
    pendingAge,
    newVsReturning,
    returningPct: allTotal ? Math.round((backTotal / allTotal) * 100) : 0,
    money: { received, refunds, voided, net: round2(received - refunds - voided), extrasPaid },
    cancelReasons,
    correctionSeries,
    prices: { count: priceAudits.length, down: round2(down), up: round2(up), lowered: [...lowered.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount) },
    bucketLabels: buckets.map((b) => b.label),
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;
