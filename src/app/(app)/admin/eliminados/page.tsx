import type { Metadata } from "next";
import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { clients, jobs, payments, users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { KIND_LABELS, METHOD_LABELS, formatWhatsapp } from "@/lib/domain";
import { formatDateTime, formatDay, formatMoney } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { RestoreButton } from "@/components/admin/restore-button";

export const metadata: Metadata = { title: "Eliminados" };

function Group({ title, empty, children, count }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-baseline justify-between border-b px-5 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        <span className="font-mono text-xs text-muted-foreground">{count}</span>
      </header>
      {count ? <ul className="divide-y">{children}</ul> : <p className="px-5 py-6 text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

/** RF-29: nada se borra de verdad; aquí se restaura. */
export default async function DeletedPage() {
  await requireUser("admin");
  const [cs, js, ps] = await Promise.all([
    db.select({ c: clients, who: users.name }).from(clients).leftJoin(users, eq(users.id, clients.deletedById)).where(isNotNull(clients.deletedAt)).orderBy(desc(clients.deletedAt)),
    db
      .select({ j: jobs, client: clients.name, who: users.name })
      .from(jobs)
      .innerJoin(clients, eq(clients.id, jobs.clientId))
      .leftJoin(users, eq(users.id, jobs.deletedById))
      .where(isNotNull(jobs.deletedAt))
      .orderBy(desc(jobs.deletedAt)),
    db
      .select({ p: payments, code: jobs.code, who: users.name })
      .from(payments)
      .innerJoin(jobs, eq(jobs.id, payments.jobId))
      .leftJoin(users, eq(users.id, payments.deletedById))
      .where(isNotNull(payments.deletedAt))
      .orderBy(desc(payments.deletedAt)),
  ]);
  const meta = (at: Date | null, who: string | null) => `Eliminado ${formatDateTime(at)} por ${who ?? "—"}`;
  return (
    <>
      <PageHeader index="Administración" title="Eliminados" description="Clientes, trabajos y pagos eliminados u anulados. Siguen guardados y se pueden restaurar." />
      <div className="grid gap-6">
        <Group title="Trabajos" count={js.length} empty="No hay trabajos eliminados.">
          {js.map(({ j, client, who }) => (
            <li key={j.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="font-mono text-xs">{j.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{client}</span>
                <span className="block text-xs text-muted-foreground">{meta(j.deletedAt, who)}</span>
              </span>
              <RestoreButton kind="trabajo" id={j.id} />
            </li>
          ))}
        </Group>
        <Group title="Clientes" count={cs.length} empty="No hay clientes eliminados.">
          {cs.map(({ c, who }) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {c.name} <span className="font-mono text-xs text-muted-foreground">{formatWhatsapp(c.whatsapp)}</span>
                </span>
                <span className="block text-xs text-muted-foreground">{meta(c.deletedAt, who)}</span>
              </span>
              <RestoreButton kind="cliente" id={c.id} />
            </li>
          ))}
        </Group>
        <Group title="Pagos anulados" count={ps.length} empty="No hay pagos anulados.">
          {ps.map(({ p, code, who }) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="font-mono text-xs">{code}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">
                  {KIND_LABELS[p.kind]} de {formatMoney(p.amount)} · {formatDay(p.paidOn)} · {METHOD_LABELS[p.method]}
                </span>
                <span className="block text-xs text-muted-foreground">{meta(p.deletedAt, who)}</span>
              </span>
              <RestoreButton kind="pago" id={p.id} />
            </li>
          ))}
        </Group>
      </div>
    </>
  );
}
