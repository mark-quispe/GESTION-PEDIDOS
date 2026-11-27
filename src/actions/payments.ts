"use server";

import { refresh } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, payments } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail, invalid } from "@/lib/action-utils";
import {
  correctPaymentSchema,
  paymentSchema,
  refundSchema,
  type CorrectPaymentInput,
  type PaymentInput,
  type RefundInput,
} from "@/lib/validation/payments";
import type { ActionResult } from "./result";

async function jobExists(jobId: string) {
  return !!(await db.query.jobs.findFirst({ where: and(eq(jobs.id, jobId), isNull(jobs.deletedAt)), columns: { id: true } }));
}

/** RF-14 y RF-15: se registra como confirmado al momento. */
export async function addPayment(input: PaymentInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertRole();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (!(await jobExists(parsed.data.jobId))) return { ok: false, error: "El trabajo no existe o fue eliminado." };
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(payments).values({ id, ...parsed.data, kind: "pago", createdById: user.id }),
      audit({ entity: "pago", entityId: id, jobId: parsed.data.jobId, action: "crear", after: parsed.data, userId: user.id }),
    ]);
    refresh();
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

/** RF-42: solo el admin. */
export async function addRefund(input: RefundInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertRole("admin");
    const parsed = refundSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (!(await jobExists(parsed.data.jobId))) return { ok: false, error: "El trabajo no existe o fue eliminado." };
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(payments).values({ id, ...parsed.data, kind: "devolucion", createdById: user.id }),
      audit({ entity: "pago", entityId: id, jobId: parsed.data.jobId, action: "devolucion", after: parsed.data, userId: user.id }),
    ]);
    refresh();
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

/** RF-15 y RF-21: el admin corrige un pago y queda el valor anterior y el nuevo. */
export async function correctPayment(input: CorrectPaymentInput): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const parsed = correctPaymentSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, reason, ...data } = parsed.data;
    const current = await db.query.payments.findFirst({ where: and(eq(payments.id, id), isNull(payments.deletedAt)) });
    if (!current) return { ok: false, error: "El pago no existe o fue anulado." };
    const before = { amount: current.amount, paidOn: current.paidOn, method: current.method, operationNumber: current.operationNumber };
    const changed = Object.entries(data).some(([k, v]) => String(before[k as keyof typeof before] ?? "") !== String(v ?? ""));
    if (!changed) return { ok: true };
    await db.batch([
      db.update(payments).set(data).where(eq(payments.id, id)),
      audit({
        entity: "pago",
        entityId: id,
        jobId: current.jobId,
        action: "corregir",
        before,
        after: { ...data, ...(reason ? { motivo: reason } : {}) },
        userId: user.id,
      }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Anular un pago (RF-29: queda oculto y se puede restaurar). */
export async function deletePayment(id: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const paymentId = z.uuid().parse(id);
    const current = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!current) return { ok: false, error: "El pago no existe." };
    await db.batch([
      db.update(payments).set({ deletedAt: new Date(), deletedById: user.id }).where(eq(payments.id, paymentId)),
      audit({ entity: "pago", entityId: paymentId, jobId: current.jobId, action: "eliminar", before: { amount: current.amount }, userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function restorePayment(id: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const paymentId = z.uuid().parse(id);
    const current = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (!current) return { ok: false, error: "El pago no existe." };
    await db.batch([
      db.update(payments).set({ deletedAt: null, deletedById: null }).where(eq(payments.id, paymentId)),
      audit({ entity: "pago", entityId: paymentId, jobId: current.jobId, action: "restaurar", userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
