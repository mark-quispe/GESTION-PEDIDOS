import "server-only";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, jobs, payments, users } from "@/db/schema";
import { addDays, dayKey, monthStart, startOfDayLima, todayLima, weekStart } from "@/lib/dates";
import { round2 } from "@/lib/domain";
import { listJobs, type JobRow } from "@/lib/queries/jobs";
import { getSettings } from "@/lib/settings";

export type DayCol = { day: string; jobs: { code: string; client: string; time: string; urgency: JobRow["urgency"]; late: boolean; id: string }[] };

export type Dashboard = {
  week: DayCol[];
  late: JobRow[];
  quotes: (JobRow & { ageDays: number })[];
  pool: JobRow[];
  hot: JobRow[];
  toSend: JobRow[];
  pending: { rows: (JobRow & { finishedAgo: number | null })[]; total: number };
  finishedWeek: JobRow[];
  load: { id: string; name: string; open: number; next: string | null; ext: boolean }[];
  alerts: { quotes: number; pending: number };
  money?: {
    today: number;
    todayCount: number;
    month: number;
    byDay: { day: string; amount: number }[];
    todayPayments: { id: string; code: string; client: string; method: string; who: string | null; amount: number; at: string; kind: string }[];
  };
};

/** Inicio (RF-19, RF-20, RF-49, RF-50, RF-56). */
export async function getDashboard(withMoney: boolean): Promise<Dashboard> {
  const now = new Date();
  const today = todayLima();
  const s = await getSettings();
  const all = await listJobs({ includeClosed: true });
  const open = all.filter((r) => r.status !== "finalizado" && r.status !== "cancelado");

  // Franja de la semana: hoy y los 6 días que siguen.
  const week: DayCol[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    return {
      day,
      jobs: open
        .filter((r) => r.status !== "cotizacion" && dayKey(r.dueAt) === day)
        .map((r) => ({ id: r.id, code: r.code, client: r.clientName, time: new Date(r.dueAt).toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false }), urgency: r.urgency, late: r.late })),
    };
  });

  const late = open.filter((r) => r.late).sort((a, b) => b.lateDays - a.lateDays);
  const quotes = open
    .filter((r) => r.status === "cotizacion")
    .map((r) => ({ ...r, ageDays: Math.max(0, Math.round((now.getTime() - new Date(r.createdAt).getTime()) / 86_400_000)) }))
    .sort((a, b) => b.ageDays - a.ageDays);
  const pool = open.filter((r) => !r.responsibleId && !r.externoId && ["confirmado", "en_proceso", "correcciones"].includes(r.status));
  // RF-49: arriba, hasta 2 muy atrasados o urgentes (tengan responsable o no).
  const hot = open
    .filter((r) => (r.late || r.urgency === "urgente") && r.status !== "cotizacion" && !["terminado", "en_revision"].includes(r.status))
    .sort((a, b) => b.lateDays - a.lateDays || a.dueAt.localeCompare(b.dueAt))
    .slice(0, 2);
  const toSend = open.filter((r) => r.status === "terminado");

  const pendingRows = all
    .filter((r) => r.status !== "cancelado" && r.status !== "cotizacion" && r.pending > 0.004)
    .map((r) => ({ ...r, finishedAgo: r.finishedAt ? Math.round((now.getTime() - new Date(r.finishedAt).getTime()) / 86_400_000) : null }))
    .sort((a, b) => (b.finishedAgo ?? -1) - (a.finishedAgo ?? -1) || b.pending - a.pending);
  const ws = weekStart(today);
  const finishedWeek = all.filter((r) => r.status === "finalizado" && r.finishedAt && dayKey(r.finishedAt) >= ws).sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!));

  // RF-50: carga por responsable (personas del estudio y externos).
  const byPerson = new Map<string, { id: string; name: string; open: number; next: string | null; ext: boolean }>();
  for (const r of open) {
    const id = r.responsibleId ?? r.externoId;
    const name = r.responsibleName ?? r.externoName;
    if (!id || !name || r.status === "cotizacion") continue;
    const p = byPerson.get(id) ?? { id, name, open: 0, next: null, ext: !!r.externoId };
    p.open++;
    if (!p.next || r.dueAt < p.next) p.next = r.dueAt;
    byPerson.set(id, p);
  }
  const load = [...byPerson.values()].sort((a, b) => b.open - a.open);

  // RF-56: avisos encendidos.
  const alerts = {
    quotes: s.alerts.quoteOn === false ? 0 : quotes.filter((q) => q.ageDays >= s.alerts.quoteDays).length,
    pending: s.alerts.pendingOn === false ? 0 : pendingRows.filter((p) => p.finishedAgo !== null && p.finishedAgo >= s.alerts.pendingDays).length,
  };

  const result: Dashboard = {
    week,
    late,
    quotes,
    pool,
    hot,
    toSend,
    pending: { rows: pendingRows, total: round2(pendingRows.reduce((a, r) => a + r.pending, 0)) },
    finishedWeek,
    load,
    alerts,
  };

  if (withMoney) {
    const from = startOfDayLima(monthStart(today));
    const rows = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        kind: payments.kind,
        method: payments.method,
        paidAt: payments.paidAt,
        code: jobs.code,
        client: clients.name,
        who: users.name,
      })
      .from(payments)
      .innerJoin(jobs, eq(jobs.id, payments.jobId))
      .innerJoin(clients, eq(clients.id, jobs.clientId))
      .leftJoin(users, eq(users.id, payments.createdById))
      .where(and(gte(payments.paidAt, from), isNull(payments.deletedAt), isNull(payments.voidedAt)))
      .orderBy(desc(payments.paidAt));
    const signed = (r: (typeof rows)[number]) => (r.kind === "devolucion" ? -r.amount : r.amount);
    const todayRows = rows.filter((r) => dayKey(r.paidAt) === today);
    const byDayMap = new Map<string, number>();
    for (const r of rows) byDayMap.set(dayKey(r.paidAt), (byDayMap.get(dayKey(r.paidAt)) ?? 0) + signed(r));
    const days = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
    result.money = {
      today: round2(todayRows.reduce((a, r) => a + signed(r), 0)),
      todayCount: todayRows.length,
      month: round2(rows.reduce((a, r) => a + signed(r), 0)),
      byDay: Array.from({ length: days }, (_, i) => {
        const d = `${today.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
        return { day: d, amount: round2(byDayMap.get(d) ?? 0) };
      }),
      todayPayments: todayRows.map((r) => ({ id: r.id, code: r.code, client: r.client, method: r.method, who: r.who, amount: r.amount, at: r.paidAt.toISOString(), kind: r.kind })),
    };
  }
  return result;
}
