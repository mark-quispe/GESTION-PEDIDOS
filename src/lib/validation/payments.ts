import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/domain";
import { isoDay, money, optionalText } from "./common";

const amount = money.refine((v) => Number(v) > 0, "El monto debe ser mayor que cero");

export const paymentSchema = z.object({
  jobId: z.uuid(),
  amount,
  paidOn: isoDay,
  method: z.enum(PAYMENT_METHODS),
  operationNumber: optionalText(60),
});
export type PaymentInput = z.input<typeof paymentSchema>;

/** RF-42 */
export const refundSchema = paymentSchema.extend({
  reason: z.string().trim().min(3, "Escribe el motivo de la devolución").max(500),
});
export type RefundInput = z.input<typeof refundSchema>;

/** RF-15: corrección por el admin. */
export const correctPaymentSchema = z.object({
  id: z.uuid(),
  amount,
  paidOn: isoDay,
  method: z.enum(PAYMENT_METHODS),
  operationNumber: optionalText(60),
  reason: optionalText(500),
});
export type CorrectPaymentInput = z.input<typeof correctPaymentSchema>;
