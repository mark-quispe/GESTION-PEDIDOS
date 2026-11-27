"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, batch } from "@/db";
import { jobExtras, jobs, payments } from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole } from "@/lib/auth-guard";
import { fail, invalid, UserError } from "@/lib/action-utils";
import { audit } from "@/lib/audit";
import { limaInstant, todayLima } from "@/lib/dates";
import { isClosed, paidNet, round2 } from "@/lib/domain";
import { formatMoney } from "@/lib/utils";
import { REFUND_REASON, paymentSchema, refundSchema, type PaymentInput, type RefundInput } from "@/lib/validation/jobs";

const done = () => revalidatePath("/", "layout");

/** Instante del pago: hoy con la hora actual, otro día al mediodía. */
function paidInstant(day: string) {
  return day === todayLima() ? new Date() : limaInstant(day, "12:00");
}

/** RF-14 y RF-15: el pago queda confirmado al momento; el admin lo revisa después. */
export async function registerPayment(input: PaymentInput): Promise<ActionResult<{ pending: number }>> {
  try {
    const user = await assertRole();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    const job = await db.query.jobs.findFirst({ where: and(eq(jobs.id, v.jobId), isNull(jobs.deletedAt)) });
    if (!job) throw new UserError("Ese trabajo ya no existe.");
    if (job.status === "cancelado" && !user.isAdmin) throw new UserError("El trabajo está cancelado.");
    const pays = await db.select().from(payments).where(and(eq(payments.jobId, job.id), isNull(payments.deletedAt)));
    const extras = await db.select().from(jobExtras).where(and(eq(jobExtras.jobId, job.id), isNull(jobExtras.deletedAt)));
    const total = round2(job.price + extras.reduce((a, e) => a + e.amount, 0));
    const paid = paidNet(pays);
    const label = paid <= 0 && job.status !== "finalizado" ? "Adelanto" : "Pago";
    await batch([
      db.insert(payments).values({
        jobId: job.id,
        amount: v.amount,
        method: v.method,
        paidAt: paidInstant(v.paidDate),
        operationNumber: v.operationNumber,
        label,
        createdById: user.id,
      }),
      audit({ entity: "pago", entityId: job.id, jobId: job.id, action: "pago", summary: `registró un pago de ${formatMoney(v.amount)}`, after: v, userId: user.id }),
    ]);
    done();
    return { ok: true, data: { pending: round2(Math.max(0, total - paid - v.amount)) } };
  } catch (e) {
    return fail(e);
  }
}

/** RF-42: devolución como movimiento aparte en negativo; puede pasar el trabajo a Cancelado. */
export async function registerRefund(input: RefundInput): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const parsed = refundSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const v = parsed.data;
    const job = await db.query.jobs.findFirst({ where: and(eq(jobs.id, v.jobId), isNull(jobs.deletedAt)) });
    if (!job) throw new UserError("Ese trabajo ya no existe.");
    // RF-48: en trabajos cerrados, solo el admin.
    if (isClosed(job.status) && !user.isAdmin) throw new UserError("Este trabajo está cerrado: solo el admin registra devoluciones.");
    const pays = await db.select().from(payments).where(and(eq(payments.jobId, job.id), isNull(payments.deletedAt)));
    const paid = paidNet(pays);
    if (v.amount > paid + 0.004) throw new UserError(`No se puede devolver más de lo pagado (${formatMoney(paid)}).`);
    const reason = `${REFUND_REASON[v.reasonKind]}${v.reasonNote ? ` · ${v.reasonNote}` : ""}`;
    const q = [
      db.insert(payments).values({
        jobId: job.id,
        kind: "devolucion",
        amount: v.amount,
        method: v.method,
        paidAt: paidInstant(v.paidDate),
        operationNumber: v.operationNumber,
        label: "Devolución",
        reason,
        createdById: user.id,
      }),
      audit({ entity: "pago", entityId: job.id, jobId: job.id, action: "devolucion", summary: `registró una devolución de ${formatMoney(v.amount)} · ${reason}`, userId: user.id }),
    ];
    if (v.cancelJob && job.status !== "cancelado") {
      q.push(
        db
          .update(jobs)
          .set({
            status: "cancelado",
            statusChangedAt: new Date(),
            cancelledAt: new Date(),
            cancelledById: user.id,
            cancelReason: REFUND_REASON[v.reasonKind],
            cancelNote: v.reasonNote,
            cancelledFromStatus: job.status,
          })
          .where(eq(jobs.id, job.id)) as never,
        audit({ entity: "trabajo", entityId: job.id, jobId: job.id, action: "anular", summary: `pasó el trabajo a Cancelado al devolver · ${reason}`, userId: user.id }) as never,
      );
    }
    await batch(q as [(typeof q)[number], ...(typeof q)[number][]]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-16: anular un pago (solo admin, con motivo). No se borra: queda tachado. */
export async function voidPayment(paymentId: string, reason: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const why = reason.trim();
    if (why.length < 3) throw new UserError("Escribe el motivo.");
    const p = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!p || p.voidedAt) throw new UserError("Ese pago ya no está vigente.");
    await batch([
      db.update(payments).set({ voidedAt: new Date(), voidedById: user.id, voidReason: why }).where(eq(payments.id, paymentId)),
      audit({
        entity: "pago",
        entityId: paymentId,
        jobId: p.jobId,
        action: "anular_pago",
        summary: `anuló ${p.kind === "devolucion" ? "la devolución" : "el pago"} de ${formatMoney(p.amount)} · «${why}»`,
        before: { amount: p.amount },
        userId: user.id,
      }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-15: el admin marca el pago como revisado (o lo desmarca). */
export async function setReviewed(paymentId: string, reviewed: boolean): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const p = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!p) throw new UserError("Ese pago ya no existe.");
    await batch([
      db
        .update(payments)
        .set(reviewed ? { reviewedAt: new Date(), reviewedById: user.id } : { reviewedAt: null, reviewedById: null })
        .where(eq(payments.id, paymentId)),
      audit({ entity: "pago", entityId: paymentId, jobId: p.jobId, action: "revisar", summary: reviewed ? `marcó revisado el pago de ${formatMoney(p.amount)}` : "quitó «revisado» de un pago", userId: user.id }),
    ]);
    done();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type JobMoney = {
  id: string;
  code: string;
  title: string;
  clientName: string;
  clientUniversity: string | null;
  dueAt: string;
  status: string;
  price: number;
  extras: number;
  total: number;
  paid: number;
  pending: number;
  advance: number | null;
  payments: { id: string; paidAt: string; method: string; amount: number; kind: "pago" | "devolucion"; voided: boolean }[];
  itemsTotal: number;
  itemsDone: number;
};

/** Resumen de dinero del trabajo para los paneles de pago y devolución. */
export async function getJobMoney(jobId: string): Promise<JobMoney | null> {
  await assertRole();
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), isNull(jobs.deletedAt)),
    with: { client: { columns: { name: true, university: true } }, items: { columns: { doneAt: true } } },
  });
  if (!job) return null;
  const pays = await db.select().from(payments).where(and(eq(payments.jobId, job.id), isNull(payments.deletedAt)));
  const extras = await db.select().from(jobExtras).where(and(eq(jobExtras.jobId, job.id), isNull(jobExtras.deletedAt)));
  const extraSum = round2(extras.reduce((a, e) => a + e.amount, 0));
  const total = round2(job.price + extraSum);
  const paid = paidNet(pays);
  const firstPay = pays.filter((p) => p.kind === "pago" && !p.voidedAt).sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())[0];
  return {
    id: job.id,
    code: job.code,
    title: job.title,
    clientName: job.client.name,
    clientUniversity: job.client.university,
    dueAt: job.dueAt.toISOString(),
    status: job.status,
    price: job.price,
    extras: extraSum,
    total,
    paid,
    pending: round2(Math.max(0, total - paid)),
    advance: firstPay?.amount ?? null,
    payments: pays
      .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())
      .map((p) => ({ id: p.id, paidAt: p.paidAt.toISOString(), method: p.method, amount: p.amount, kind: p.kind, voided: !!p.voidedAt })),
    itemsTotal: job.items.length,
    itemsDone: job.items.filter((i) => i.doneAt).length,
  };
}
