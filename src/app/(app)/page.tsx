import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { jobs, payments, users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { addDays, monthStart, todayLima } from "@/lib/dates";
import { CLOSED_STATUSES, METHOD_LABELS } from "@/lib/domain";
import { listJobs, type JobListRow } from "@/lib/queries";
import { formatDay, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { LateBadge, StatusBadge, UrgencyBadge } from "@/components/jobs/badges";
import { IncomeChart } from "@/components/dashboard/income-chart";

export const metadata: Metadata = { title: "Inicio" };

function Panel({ title, count, tone, children, href }: { title: string; count?: number | string; tone?: "danger" | "warning"; children: React.ReactNode; href?: string }) {
  return (
    <section className="flex min-w-0 flex-col rounded-lg border bg-card">
      <header className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className={tone === "danger" ? "text-sm font-medium text-danger" : tone === "warning" ? "text-sm font-medium text-warning" : "text-sm font-medium"}>{title}</h2>
        {count !== undefined && <span className="font-mono text-xs text-muted-foreground">{count}</span>}
      </header>
      <div className="flex-1">{children}</div>
      {href && (
        <Link href={href} className="border-t px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
          Ver todos →
        </Link>
      )}
    </section>
  );
}

function JobLines({ rows, empty, right }: { rows: JobListRow[]; empty: string; right?: (r: JobListRow) => React.ReactNode }) {
  if (!rows.length) return <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {rows.slice(0, 8).map((r) => (
        <li key={r.id}>
          <Link href={`/trabajos/${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{r.code}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{r.clientName}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.course ?? r.description}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">{right ? right(r) : <StatusBadge status={r.status} />}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function HomePage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const today = todayLima();
  const tomorrow = addDays(today, 1);

  const all = await listJobs();
  const open = all.filter((r) => !CLOSED_STATUSES.includes(r.status));
  const dueToday = open.filter((r) => r.dueDate === today);
  const dueTomorrow = open.filter((r) => r.dueDate === tomorrow);
  const late = open.filter((r) => r.late).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const quotes = all.filter((r) => r.status === "cotizado");
  const receivable = all.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  const receivableTotal = receivable.reduce((s, r) => s + r.balance, 0);

  // RF-20: solo para el admin.
  const signed = sql<string>`case when ${payments.kind} = 'pago' then ${payments.amount} else -${payments.amount} end`;
  const [todayPayments, monthByDay] = isAdmin
    ? await Promise.all([
        db
          .select({ id: payments.id, kind: payments.kind, amount: payments.amount, method: payments.method, code: jobs.code, jobId: jobs.id, who: users.name })
          .from(payments)
          .innerJoin(jobs, eq(jobs.id, payments.jobId))
          .leftJoin(users, eq(users.id, payments.createdById))
          .where(and(isNull(payments.deletedAt), eq(payments.paidOn, today)))
          .orderBy(payments.createdAt),
        db
          .select({ day: payments.paidOn, total: sql<string>`sum(${signed})` })
          .from(payments)
          .where(and(isNull(payments.deletedAt), gte(payments.paidOn, monthStart(today)), lte(payments.paidOn, today)))
          .groupBy(payments.paidOn),
      ])
    : [[], []];
  const todayTotal = todayPayments.reduce((s, p) => s + (p.kind === "pago" ? 1 : -1) * Number(p.amount), 0);
  const byDay = new Map(monthByDay.map((d) => [d.day, Number(d.total)]));
  const chart: { day: string; label: string; total: number }[] = [];
  for (let d = monthStart(today); d <= today; d = addDays(d, 1)) {
    chart.push({ day: d.slice(8), label: formatDay(d, { weekday: "long", day: "numeric", month: "long" }), total: byDay.get(d) ?? 0 });
  }
  const monthTotal = chart.reduce((s, p) => s + p.total, 0);

  return (
    <>
      <PageHeader
        index={formatDay(today, { weekday: "long", day: "numeric", month: "long" })}
        title="Inicio"
        description="Lo que hay que entregar, cobrar y responder."
      >
        <Button asChild>
          <Link href="/trabajos/nuevo">
            <Plus /> Nuevo trabajo
          </Link>
        </Button>
      </PageHeader>

      {isAdmin && (
        <section aria-label="Dinero" className="mb-6 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-[1fr_1fr_2fr]">
          <div className="bg-card px-5 py-4">
            <p className="font-mono text-[11px] text-muted-foreground">Pagos de hoy</p>
            <p className="mt-1.5 text-2xl font-medium tabular-nums">{formatMoney(todayTotal)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{todayPayments.length} movimientos</p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="font-mono text-[11px] text-muted-foreground">Ingresos del mes</p>
            <p className="mt-1.5 text-2xl font-medium tabular-nums">{formatMoney(monthTotal)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Pagos menos devoluciones</p>
          </div>
          <div className="bg-card px-4 py-3">
            <IncomeChart data={chart} />
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Entregas de hoy" count={dueToday.length}>
          <JobLines rows={dueToday} empty="Nada que entregar hoy." right={(r) => <><UrgencyBadge urgency={r.urgency} /><StatusBadge status={r.status} /></>} />
        </Panel>
        <Panel title="Entregas de mañana" count={dueTomorrow.length}>
          <JobLines rows={dueTomorrow} empty="Nada para mañana." right={(r) => <><UrgencyBadge urgency={r.urgency} /><StatusBadge status={r.status} /></>} />
        </Panel>
        <Panel title="Atrasados" count={late.length} tone={late.length ? "danger" : undefined} href={late.length > 8 ? "/trabajos?atrasados=1" : undefined}>
          <JobLines
            rows={late}
            empty="Ningún trabajo atrasado."
            right={(r) => (
              <>
                <span className="font-mono text-xs text-danger">{formatDay(r.dueDate)}</span>
                <LateBadge />
              </>
            )}
          />
        </Panel>
        <Panel title="Cotizaciones sin respuesta" count={quotes.length} href={quotes.length > 8 ? "/trabajos?estado=cotizado" : undefined}>
          <JobLines rows={quotes} empty="No hay cotizaciones esperando." right={(r) => <span className="font-mono text-xs tabular-nums">{formatMoney(r.price)}</span>} />
        </Panel>
        <Panel title="Saldos por cobrar" count={formatMoney(receivableTotal)} tone={receivable.length ? "warning" : undefined} href={receivable.length > 8 ? "/trabajos?saldo=1" : undefined}>
          <JobLines rows={receivable} empty="No hay saldos pendientes." right={(r) => <span className="font-mono text-xs tabular-nums">{formatMoney(r.balance)}</span>} />
        </Panel>
        {isAdmin && (
          <Panel title="Pagos registrados hoy" count={todayPayments.length} href="/pagos">
            {todayPayments.length ? (
              <ul className="divide-y">
                {todayPayments.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <Link href={`/trabajos/${p.jobId}`} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50">
                      <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{p.code}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {METHOD_LABELS[p.method]} · {p.who ?? "—"}
                      </span>
                      <span className={p.kind === "devolucion" ? "font-mono text-xs text-danger tabular-nums" : "font-mono text-xs tabular-nums"}>
                        {p.kind === "devolucion" ? "−" : ""}
                        {formatMoney(p.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">Todavía no hay pagos hoy.</p>
            )}
          </Panel>
        )}
      </div>
    </>
  );
}
