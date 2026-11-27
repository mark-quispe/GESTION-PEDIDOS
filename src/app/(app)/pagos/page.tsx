import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { clients, jobs, payments, users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { addDays, todayLima, weekStart } from "@/lib/dates";
import { METHOD_LABELS, PAYMENT_METHODS } from "@/lib/domain";
import { cn, formatDateTime, formatDay, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Pagos" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** RF-15: el admin compara los pagos del día o la semana con su app de Yape o del banco. */
export default async function PaymentsPage({ searchParams }: PageProps<"/pagos">) {
  await requireUser("admin");
  const sp = await searchParams;
  const today = todayLima();
  const view = sp.vista === "semana" ? "semana" : "dia";
  const day = typeof sp.fecha === "string" && DAY.test(sp.fecha) ? sp.fecha : today;
  const from = view === "semana" ? weekStart(day) : day;
  const to = view === "semana" ? addDays(from, 6) : day;

  const rows = await db
    .select({ p: payments, code: jobs.code, jobId: jobs.id, client: clients.name, who: users.name, whoEmail: users.email })
    .from(payments)
    .innerJoin(jobs, eq(jobs.id, payments.jobId))
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .leftJoin(users, eq(users.id, payments.createdById))
    .where(and(isNull(payments.deletedAt), gte(payments.paidOn, from), lte(payments.paidOn, to)))
    .orderBy(asc(payments.paidOn), asc(payments.method), asc(payments.createdAt));

  const sign = (k: string) => (k === "pago" ? 1 : -1);
  const total = rows.reduce((s, r) => s + sign(r.p.kind) * Number(r.p.amount), 0);
  const byMethod = PAYMENT_METHODS.map((m) => ({ m, total: rows.filter((r) => r.p.method === m).reduce((s, r) => s + sign(r.p.kind) * Number(r.p.amount), 0), n: rows.filter((r) => r.p.method === m).length }));
  const step = view === "semana" ? 7 : 1;
  const link = (d: string, v = view) => `/pagos?vista=${v}&fecha=${d}`;

  return (
    <>
      <PageHeader
        index="Pagos"
        title={view === "semana" ? `Semana del ${formatDay(from, { day: "numeric", month: "long" })}` : formatDay(day, { weekday: "long", day: "numeric", month: "long" })}
        description="Compáralos con tu app de Yape, Plin o del banco. Si algo no cuadra, corrígelo desde la ficha del trabajo."
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted p-0.5">
            {(["dia", "semana"] as const).map((v) => (
              <Link key={v} href={link(day, v)} className={cn("flex h-10 items-center rounded-md px-3 text-sm text-muted-foreground sm:h-8", view === v && "bg-card text-foreground shadow-xs")}>
                {v === "dia" ? "Día" : "Semana"}
              </Link>
            ))}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={link(addDays(from, -step))}>Anterior</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={link(today)}>Hoy</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={link(addDays(from, step))}>Siguiente</Link>
          </Button>
          <form className="flex gap-1">
            <input type="hidden" name="vista" value={view} />
            <Input type="date" name="fecha" defaultValue={day} aria-label="Ir a la fecha" className="w-auto" />
            <Button type="submit" variant="ghost" size="sm">
              Ir
            </Button>
          </form>
        </div>
      </PageHeader>

      <section aria-label="Totales" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-5">
        <div className="bg-card px-4 py-3">
          <p className="font-mono text-[11px] text-muted-foreground">Total</p>
          <p className="mt-1 text-xl font-medium tabular-nums">{formatMoney(total)}</p>
          <p className="text-xs text-muted-foreground">{rows.length} movimientos</p>
        </div>
        {byMethod.map(({ m, total, n }) => (
          <div key={m} className="bg-card px-4 py-3">
            <p className="font-mono text-[11px] text-muted-foreground">{METHOD_LABELS[m]}</p>
            <p className="mt-1 text-xl font-medium tabular-nums">{formatMoney(total)}</p>
            <p className="text-xs text-muted-foreground">{n} movimientos</p>
          </div>
        ))}
      </section>

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {view === "semana" && <TableHead>Fecha</TableHead>}
            <TableHead>Medio</TableHead>
            <TableHead>N.º operación</TableHead>
            <TableHead>Trabajo</TableHead>
            <TableHead className="max-md:hidden">Registró</TableHead>
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ p, code, jobId, client, who, whoEmail }) => (
            <TableRow key={p.id}>
              {view === "semana" && <TableCell className="font-mono text-xs">{formatDay(p.paidOn, { weekday: "short", day: "numeric" })}</TableCell>}
              <TableCell>
                {METHOD_LABELS[p.method]}
                {p.kind === "devolucion" && <span className="ml-2 text-xs text-danger">Devolución</span>}
              </TableCell>
              <TableCell className="font-mono text-xs">{p.operationNumber ?? "—"}</TableCell>
              <TableCell>
                <Link href={`/trabajos/${jobId}`} className="underline-offset-4 hover:underline">
                  <span className="font-mono text-xs">{code}</span> <span className="text-muted-foreground">{client}</span>
                </Link>
                {p.receiptLink && (
                  <a href={p.receiptLink} target="_blank" rel="noreferrer" className="ml-2 text-xs underline underline-offset-4">
                    Captura
                  </a>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-md:hidden">
                {who ?? whoEmail ?? "—"} · {formatDateTime(p.createdAt)}
              </TableCell>
              <TableCell className={cn("text-right tabular-nums", p.kind === "devolucion" && "text-danger")}>
                {p.kind === "devolucion" ? "−" : ""}
                {formatMoney(p.amount)}
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No hay pagos en este periodo.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
