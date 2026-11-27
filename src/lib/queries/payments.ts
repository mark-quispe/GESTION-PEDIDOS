import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { auditLog, clients, jobFiles, jobs, payments, users } from "@/db/schema";
import { addDays, startOfDayLima } from "@/lib/dates";
import { listJobs } from "@/lib/queries/jobs";

export type PaymentRow = {
  id: string;
  jobId: string;
  code: string;
  jobTitle: string;
  client: string;
  kind: "pago" | "devolucion";
  amount: number;
  method: "yape" | "plin" | "transferencia" | "efectivo";
  operationNumber: string | null;
  label: string | null;
  reason: string | null;
  paidAt: string;
  createdAt: string;
  createdBy: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  receiptLink: string | null;
  jobPending: number;
  jobTotal: number;
  history: { at: string; who: string | null; summary: string }[];
};

/** Pagos del periodo para cuadrar con Yape o el banco (RF-15). */
export async function listPayments(fromDay: string, toDayExclusive: string): Promise<PaymentRow[]> {
  const creator = alias(users, "creator");
  const reviewer = alias(users, "reviewer");
  const voider = alias(users, "voider");
  const rows = await db
    .select({
      p: payments,
      code: jobs.code,
      jobTitle: jobs.title,
      client: clients.name,
      createdBy: creator.name,
      reviewedBy: reviewer.name,
      voidedBy: voider.name,
    })
    .from(payments)
    .innerJoin(jobs, eq(jobs.id, payments.jobId))
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .leftJoin(creator, eq(creator.id, payments.createdById))
    .leftJoin(reviewer, eq(reviewer.id, payments.reviewedById))
    .leftJoin(voider, eq(voider.id, payments.voidedById))
    .where(and(isNull(payments.deletedAt), gte(payments.paidAt, startOfDayLima(fromDay)), lt(payments.paidAt, startOfDayLima(toDayExclusive))))
    .orderBy(asc(payments.paidAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.p.id);
  const jobIds = [...new Set(rows.map((r) => r.p.jobId))];
  const [hist, files, jobRows] = await Promise.all([
    db
      .select({ entityId: auditLog.entityId, at: auditLog.createdAt, who: users.name, summary: auditLog.summary })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(and(eq(auditLog.entity, "pago"), inArray(auditLog.entityId, ids)))
      .orderBy(asc(auditLog.createdAt)),
    db.select({ paymentId: jobFiles.paymentId, link: jobFiles.webViewLink }).from(jobFiles).where(and(inArray(jobFiles.jobId, jobIds), isNull(jobFiles.deletedAt))),
    listJobs({ includeClosed: true }),
  ]);
  const jobBy = new Map(jobRows.map((j) => [j.id, j]));
  return rows.map(({ p, ...r }) => ({
    id: p.id,
    jobId: p.jobId,
    code: r.code,
    jobTitle: r.jobTitle,
    client: r.client,
    kind: p.kind,
    amount: p.amount,
    method: p.method,
    operationNumber: p.operationNumber,
    label: p.label,
    reason: p.reason,
    paidAt: p.paidAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    createdBy: r.createdBy,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    reviewedBy: r.reviewedBy,
    voidedAt: p.voidedAt?.toISOString() ?? null,
    voidedBy: r.voidedBy,
    voidReason: p.voidReason,
    receiptLink: p.receiptLink ?? files.find((f) => f.paymentId === p.id)?.link ?? null,
    jobPending: jobBy.get(p.jobId)?.pending ?? 0,
    jobTotal: jobBy.get(p.jobId)?.total ?? 0,
    history: hist.filter((h) => h.entityId === p.id).map((h) => ({ at: h.at.toISOString(), who: h.who, summary: h.summary ?? "" })),
  }));
}

/** RF-16: filtro «Precios cambiados» (cambios de precio con motivo en el periodo). */
export async function priceChanges(fromDay: string, toDayExclusive: string) {
  return db
    .select({ id: auditLog.id, jobId: auditLog.jobId, at: auditLog.createdAt, who: users.name, summary: auditLog.summary, code: jobs.code, client: clients.name })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .innerJoin(jobs, eq(jobs.id, auditLog.jobId))
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .where(and(eq(auditLog.action, "precio"), gte(auditLog.createdAt, startOfDayLima(fromDay)), lt(auditLog.createdAt, startOfDayLima(addDays(toDayExclusive, 0)))))
    .orderBy(desc(auditLog.createdAt));
}
