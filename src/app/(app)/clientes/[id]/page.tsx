import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/db";
import { clients, jobs, payments } from "@/db/schema";
import { deleteClient } from "@/actions/clients";
import { requireUser } from "@/lib/auth-guard";
import { METHOD_LABELS, formatWhatsapp } from "@/lib/domain";
import { listJobs } from "@/lib/queries";
import { formatDateTime, formatDay, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LateBadge, PaymentBadge, StatusBadge } from "@/components/jobs/badges";
import { ConfirmButton } from "@/components/jobs/job-panels";
import { Observations } from "@/components/clients/observations";

export const metadata: Metadata = { title: "Cliente" };

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="font-mono text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export default async function ClientPage({ params }: PageProps<"/clientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const client = await db.query.clients.findFirst({ where: and(eq(clients.id, id), isNull(clients.deletedAt)), with: { preferredResponsable: true } });
  if (!client) notFound();

  // RF-07: sus trabajos y lo que ha pagado.
  const [rows, paid] = await Promise.all([
    listJobs(eq(jobs.clientId, id)),
    db
      .select({ p: payments, code: jobs.code })
      .from(payments)
      .innerJoin(jobs, eq(jobs.id, payments.jobId))
      .where(and(eq(jobs.clientId, id), isNull(payments.deletedAt), isNull(jobs.deletedAt)))
      .orderBy(desc(payments.paidOn)),
  ]);
  const totalPaid = paid.reduce((s, { p }) => s + (p.kind === "pago" ? 1 : -1) * Number(p.amount), 0);
  const debt = rows.reduce((s, r) => s + Math.max(0, r.balance), 0);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <p className="mb-2 font-mono text-xs text-muted-foreground">
            <Link href="/clientes" className="hover:text-foreground">
              Clientes
            </Link>
          </p>
          <h1 className="text-3xl font-medium">{client.name}</h1>
          <a href={`https://wa.me/${client.whatsapp}`} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-sm text-muted-foreground underline-offset-4 hover:underline">
            {formatWhatsapp(client.whatsapp)}
          </a>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* RF-38 */}
          <Button asChild>
            <Link href={`/trabajos/nuevo?cliente=${client.id}`}>
              <Plus /> Nuevo trabajo para este cliente
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/clientes/${client.id}/editar`}>
              <Pencil /> Editar
            </Link>
          </Button>
          {user.role === "admin" && (
            <ConfirmButton
              label="Eliminar"
              icon={<Trash2 />}
              title={`¿Eliminar a ${client.name}?`}
              description="Se oculta de las listas; sus trabajos se conservan. Puedes restaurarlo desde Eliminados."
              confirmLabel="Eliminar"
              action={deleteClient.bind(null, client.id)}
              redirectTo="/clientes"
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid min-w-0 content-start gap-6">
          <section className="rounded-lg border bg-card">
            <header className="flex items-baseline justify-between border-b px-5 py-3">
              <h2 className="text-sm font-medium">Trabajos</h2>
              <span className="font-mono text-xs text-muted-foreground">{rows.length}</span>
            </header>
            {rows.length ? (
              <ul className="divide-y">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`/trabajos/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 transition-colors hover:bg-muted/50">
                      <span className="w-20 font-mono text-xs text-muted-foreground">{r.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {r.course ?? r.description}
                        {r.parentJobId && <span className="text-xs text-muted-foreground"> · relacionado</span>}
                      </span>
                      <StatusBadge status={r.status} />
                      {r.late && <LateBadge />}
                      <span className="w-24 text-right text-sm tabular-nums">{formatMoney(r.price)}</span>
                      {r.price !== null && r.status !== "cancelado" && <PaymentBadge status={r.paymentStatus} />}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">Todavía no tiene trabajos.</p>
            )}
          </section>

          <section className="rounded-lg border bg-card">
            <header className="flex items-baseline justify-between border-b px-5 py-3">
              <h2 className="text-sm font-medium">Pagos</h2>
              <span className="font-mono text-xs text-muted-foreground">{formatMoney(totalPaid)}</span>
            </header>
            {paid.length ? (
              <ul className="divide-y text-sm">
                {paid.map(({ p, code }) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2.5">
                    <span className="w-20 font-mono text-xs text-muted-foreground">{code}</span>
                    <span className="flex-1 text-muted-foreground">
                      {formatDay(p.paidOn, { day: "numeric", month: "short", year: "numeric" })} · {METHOD_LABELS[p.method]}
                    </span>
                    <span className={p.kind === "devolucion" ? "text-danger tabular-nums" : "tabular-nums"}>
                      {p.kind === "devolucion" ? "−" : ""}
                      {formatMoney(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted-foreground">Sin pagos.</p>
            )}
          </section>
        </div>

        <div className="grid content-start gap-6">
          <section className="rounded-lg border bg-card p-5">
            <dl className="grid grid-cols-2 gap-4">
              <Item label="Pagado">{formatMoney(totalPaid)}</Item>
              <Item label="Debe">
                <span className={debt > 0 ? "text-warning" : undefined}>{formatMoney(debt)}</span>
              </Item>
              <Item label="Universidad">{client.university}</Item>
              <Item label="Carrera · ciclo">{[client.career, client.cycle && `ciclo ${client.cycle}`].filter(Boolean).join(" · ")}</Item>
              <Item label="Cómo llegó">{client.source}</Item>
              <Item label="Cliente desde">{formatDateTime(client.createdAt)}</Item>
            </dl>
          </section>
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium">Preferencias</h2>
            <dl className="grid grid-cols-2 gap-4">
              <Item label="Software">{[client.software, client.softwareVersion].filter(Boolean).join(" ")}</Item>
              <Item label="Formato">{client.usualFormat}</Item>
              <Item label="Suele trabajar con">{client.preferredResponsable?.name}</Item>
            </dl>
          </section>
          <section className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-sm font-medium">Observaciones</h2>
            <Observations clientId={client.id} initial={client.observations} />
          </section>
        </div>
      </div>
    </>
  );
}
