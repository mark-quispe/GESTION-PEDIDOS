import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, clients, jobs, payments, users } from "@/db/schema";
import { METHOD_LABEL, formatPhone } from "@/lib/domain";

export type DeletedKind = "trabajo" | "pago" | "cliente";
export type DeletedRow = { kind: DeletedKind; id: string; title: string; sub: string; reason: string | null; by: string | null; at: string; search: string };

/** RF-29: lo eliminado (clientes, trabajos y pagos), lo más reciente primero. */
export async function listDeleted(): Promise<DeletedRow[]> {
  const [cs, js, ps, people] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, whatsapp: clients.whatsapp, at: clients.deletedAt, by: clients.deletedById, jobs: sql<number>`(select count(*)::int from jobs j where j.client_id = ${clients.id} and j.deleted_at is null)` })
      .from(clients)
      .where(isNotNull(clients.deletedAt)),
    db
      .select({ id: jobs.id, code: jobs.code, title: jobs.title, client: clients.name, at: jobs.deletedAt, by: jobs.deletedById })
      .from(jobs)
      .innerJoin(clients, eq(clients.id, jobs.clientId))
      .where(isNotNull(jobs.deletedAt)),
    db
      .select({ id: payments.id, amount: payments.amount, kind: payments.kind, method: payments.method, code: jobs.code, client: clients.name, at: payments.deletedAt, by: payments.deletedById })
      .from(payments)
      .innerJoin(jobs, eq(jobs.id, payments.jobId))
      .innerJoin(clients, eq(clients.id, jobs.clientId))
      .where(and(isNotNull(payments.deletedAt), isNull(jobs.deletedAt))),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const ids = [...cs.map((c) => c.id), ...js.map((j) => j.id), ...ps.map((p) => p.id)];
  const logs = ids.length
    ? await db.select({ entityId: auditLog.entityId, after: auditLog.after }).from(auditLog).where(and(eq(auditLog.action, "eliminar"), inArray(auditLog.entityId, ids))).orderBy(desc(auditLog.createdAt))
    : [];
  const reason = (id: string) => {
    const a = logs.find((l) => l.entityId === id)?.after as { reason?: string } | null | undefined;
    return a?.reason ?? null;
  };
  const who = (id: string | null) => people.find((u) => u.id === id)?.name ?? null;
  const money = (n: number) => `S/ ${n.toFixed(2)}`;

  const rows: DeletedRow[] = [
    ...js.map((j) => ({ kind: "trabajo" as const, id: j.id, title: j.code, sub: `${j.title} · ${j.client}`, reason: reason(j.id), by: who(j.by), at: j.at!.toISOString(), search: `${j.code} ${j.title} ${j.client}` })),
    ...ps.map((p) => ({
      kind: "pago" as const,
      id: p.id,
      title: `${p.kind === "devolucion" ? "−" : ""}${money(p.amount)}`,
      sub: `${METHOD_LABEL[p.method]} · ${p.code} · ${p.client}`,
      reason: reason(p.id),
      by: who(p.by),
      at: p.at!.toISOString(),
      search: `${p.amount} ${p.code} ${p.client}`,
    })),
    ...cs.map((c) => ({ kind: "cliente" as const, id: c.id, title: c.name, sub: `${formatPhone(c.whatsapp)} · ${c.jobs} ${c.jobs === 1 ? "trabajo" : "trabajos"}`, reason: reason(c.id), by: who(c.by), at: c.at!.toISOString(), search: `${c.name} ${c.whatsapp}` })),
  ];
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}
