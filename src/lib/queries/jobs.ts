import type { PaymentMethod } from "@/db/schema";
import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  clientObservations,
  clients,
  externos,
  jobCorrections,
  jobExtras,
  jobFiles,
  jobItems,
  jobNotes,
  jobs,
  jobViews,
  payments,
  users,
  type JobStatus,
  type Urgency,
} from "@/db/schema";
import { isLate, lateDays, paidNet, payState, round2, type PayState } from "@/lib/domain";

/* ---------- Lista (RF-12) ---------- */

export type JobRow = {
  id: string;
  code: string;
  title: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  course: string | null;
  university: string | null;
  status: JobStatus;
  urgency: Urgency;
  dueAt: string;
  createdAt: string;
  statusChangedAt: string;
  finishedAt: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  externoId: string | null;
  externoName: string | null;
  /** Precio pactado + extras. */
  total: number;
  paid: number;
  pending: number;
  payState: PayState;
  itemsTotal: number;
  itemsDone: number;
  /** Medios con que pagó (para el filtro «Medio»). */
  methods: PaymentMethod[];
  late: boolean;
  lateDays: number;
  correctionRounds: number;
};

/** Todos los trabajos visibles (sin eliminados), con sus montos y avance. */
export async function listJobs(opts: { includeClosed?: boolean } = {}): Promise<JobRow[]> {
  const now = new Date();
  const where = opts.includeClosed ? isNull(jobs.deletedAt) : and(isNull(jobs.deletedAt), sql`${jobs.status} not in ('finalizado','cancelado')`);
  const rows = await db
    .select({
      id: jobs.id,
      code: jobs.code,
      title: jobs.title,
      clientId: jobs.clientId,
      clientName: clients.name,
      clientPhone: clients.whatsapp,
      course: jobs.course,
      university: jobs.university,
      status: jobs.status,
      urgency: jobs.urgency,
      dueAt: jobs.dueAt,
      createdAt: jobs.createdAt,
      statusChangedAt: jobs.statusChangedAt,
      finishedAt: jobs.finishedAt,
      responsibleId: jobs.responsibleId,
      responsibleName: users.name,
      externoId: jobs.externoId,
      externoName: externos.name,
      price: jobs.price,
      correctionRounds: jobs.correctionRounds,
    })
    .from(jobs)
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .leftJoin(users, eq(users.id, jobs.responsibleId))
    .leftJoin(externos, eq(externos.id, jobs.externoId))
    .where(where)
    .orderBy(asc(jobs.dueAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [pays, extras, items] = await Promise.all([
    db
      .select({ jobId: payments.jobId, kind: payments.kind, amount: payments.amount, voidedAt: payments.voidedAt, method: payments.method })
      .from(payments)
      .where(and(inArray(payments.jobId, ids), isNull(payments.deletedAt))),
    db
      .select({ jobId: jobExtras.jobId, total: sql<number>`coalesce(sum(${jobExtras.amount}),0)::float` })
      .from(jobExtras)
      .where(and(inArray(jobExtras.jobId, ids), isNull(jobExtras.deletedAt)))
      .groupBy(jobExtras.jobId),
    db
      .select({
        jobId: jobItems.jobId,
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(${jobItems.doneAt})::int`,
      })
      .from(jobItems)
      .where(inArray(jobItems.jobId, ids))
      .groupBy(jobItems.jobId),
  ]);
  const payBy = new Map<string, typeof pays>();
  for (const p of pays) payBy.set(p.jobId, [...(payBy.get(p.jobId) ?? []), p]);
  const extraBy = new Map(extras.map((e) => [e.jobId, Number(e.total)]));
  const itemBy = new Map(items.map((i) => [i.jobId, i]));

  return rows.map((r) => {
    const total = round2(r.price + (extraBy.get(r.id) ?? 0));
    const paid = paidNet(payBy.get(r.id) ?? []);
    const it = itemBy.get(r.id);
    return {
      ...r,
      dueAt: r.dueAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      statusChangedAt: r.statusChangedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      total,
      paid,
      pending: r.status === "cancelado" ? 0 : round2(Math.max(0, total - paid)),
      payState: payState(total, paid),
      itemsTotal: it?.total ?? 0,
      itemsDone: it?.done ?? 0,
      methods: [...new Set((payBy.get(r.id) ?? []).filter((p) => !p.voidedAt && p.kind === "pago").map((p) => p.method))],
      late: isLate(r.status, r.dueAt, now),
      lateDays: lateDays(r.status, r.dueAt, now),
    };
  });
}

/** «Seguir donde te quedaste»: el último trabajo que abrió esta persona. */
export async function lastViewedJob(userId: string) {
  const [row] = await db
    .select({ code: jobs.code, title: jobs.title })
    .from(jobViews)
    .innerJoin(jobs, eq(jobs.id, jobViews.jobId))
    .where(and(eq(jobViews.userId, userId), isNull(jobs.deletedAt)))
    .orderBy(desc(jobViews.lastSeenAt))
    .limit(1);
  return row ?? null;
}

/* ---------- Ficha ---------- */

export async function getJobByCode(code: string) {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.code, code.toUpperCase()), isNull(jobs.deletedAt)),
    with: {
      client: true,
      responsible: { columns: { id: true, name: true } },
      externo: true,
      createdBy: { columns: { id: true, name: true } },
      finishedBy: { columns: { id: true, name: true } },
      cancelledBy: { columns: { id: true, name: true } },
      items: { orderBy: [asc(jobItems.sortOrder)], with: { doneBy: { columns: { id: true, name: true } }, doneByExterno: { columns: { id: true, name: true } } } },
      corrections: { orderBy: [asc(jobCorrections.number)], with: { receivedBy: { columns: { name: true } }, takenBy: { columns: { name: true } }, externo: { columns: { name: true } } } },
      extras: { where: isNull(jobExtras.deletedAt), orderBy: [asc(jobExtras.createdAt)], with: { createdBy: { columns: { name: true } } } },
      payments: {
        where: isNull(payments.deletedAt),
        orderBy: [asc(payments.paidAt)],
        with: { createdBy: { columns: { name: true } }, voidedBy: { columns: { name: true } } },
      },
      notes: { orderBy: [desc(jobNotes.createdAt)], with: { author: { columns: { id: true, name: true } } } },
      files: { where: isNull(jobFiles.deletedAt), orderBy: [asc(jobFiles.createdAt)], with: { uploadedBy: { columns: { name: true } } } },
      continues: { columns: { id: true, code: true, title: true } },
      continuedBy: { columns: { id: true, code: true, title: true } },
      parent: { columns: { id: true, code: true, title: true } },
      children: { columns: { id: true, code: true, title: true, status: true } },
    },
  });
  return job ?? null;
}

export type JobDetail = NonNullable<Awaited<ReturnType<typeof getJobByCode>>>;

/** Historial del trabajo (RF-21) para la pestaña Historial de la ficha. */
export async function jobHistory(jobId: string) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      summary: auditLog.summary,
      entity: auditLog.entity,
      createdAt: auditLog.createdAt,
      userName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(eq(auditLog.jobId, jobId))
    .orderBy(desc(auditLog.createdAt))
    .limit(200);
}

/** Marca la ficha como vista (notas sin leer, seguir donde te quedaste). Devuelve la visita anterior. */
export async function touchJobView(userId: string, jobId: string) {
  const prev = await db.query.jobViews.findFirst({ where: and(eq(jobViews.userId, userId), eq(jobViews.jobId, jobId)) });
  await db
    .insert(jobViews)
    .values({ userId, jobId, lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: [jobViews.userId, jobViews.jobId], set: { lastSeenAt: new Date() } });
  return prev?.lastSeenAt ?? null;
}

/** Observaciones del cliente que piden aviso al crear un trabajo (RF-45). */
export async function clientAlerts(clientId: string) {
  return db
    .select({ id: clientObservations.id, body: clientObservations.body, kind: clientObservations.kind })
    .from(clientObservations)
    .where(and(eq(clientObservations.clientId, clientId), eq(clientObservations.alertOnNewJob, true)));
}
