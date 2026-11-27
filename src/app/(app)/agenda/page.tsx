import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { listJobs } from "@/lib/queries/jobs";
import { addDays, dayKey, todayLima, weekStart } from "@/lib/dates";
import { PageBody } from "@/components/layout/page-header";
import { AgendaBoard } from "@/components/agenda/agenda-board";

export const metadata = { title: "Agenda" };

/** RF-41: 7 días con hoy al medio (3 atrás y 3 adelante) y una columna de atrasados, sin montos. */
export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayLima();
  const center = typeof sp.d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(center, i - 3));
  const all = await listJobs({ includeClosed: true });
  const visible = all.filter((r) => r.status !== "cotizacion" && r.status !== "cancelado");
  const inRange = visible.filter((r) => days.includes(dayKey(r.dueAt)) && !r.late);
  const late = visible.filter((r) => r.late);

  // Tira de Producción: quien puede tomar (Producción o admin) y los externos con trabajos.
  const staff = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.active, true), sql`(${users.roles} && array['produccion','admin']::text[])`))
    .orderBy(asc(users.name));
  const ws = weekStart(today);
  const people = [
    ...staff.map((s) => ({ id: s.id, name: s.name, ext: false })),
    ...[...new Map(visible.filter((r) => r.externoId).map((r) => [r.externoId!, r.externoName!])).entries()].map(([id, name]) => ({ id, name, ext: true })),
  ].map((p) => ({
    ...p,
    open: visible.filter((r) => (r.responsibleId === p.id || r.externoId === p.id) && r.status !== "finalizado").length,
    doneWeek: visible.filter((r) => (r.responsibleId === p.id || r.externoId === p.id) && r.status === "finalizado" && r.finishedAt && dayKey(r.finishedAt) >= ws).length,
  }));

  // «X tiene más espacio esta semana» (solo el admin).
  let hint: { name: string; rest: string } | null = null;
  if (user.isAdmin && !user.viewAsEmployee) {
    const free = people
      .filter((p) => !p.ext)
      .map((p) => ({ ...p, soon: visible.filter((r) => r.responsibleId === p.id && r.status !== "finalizado" && dayKey(r.dueAt) <= addDays(today, 2)).length }))
      .sort((a, b) => a.open - b.open || a.soon - b.soon)[0];
    if (free && people.filter((p) => !p.ext).length > 1)
      hint = { name: free.name, rest: `${free.open} en curso${free.soon === 0 ? " y nada para entregar en los próximos 2 días" : ""}.` };
  }

  return (
    <PageBody>
      <AgendaBoard days={days} today={today} center={center} rows={inRange} late={late} people={people} canTake={user.canTake} hint={hint} />
    </PageBody>
  );
}
