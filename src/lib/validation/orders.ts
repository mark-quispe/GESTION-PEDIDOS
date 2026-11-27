import { z } from "zod";
import { orderStatusEnum } from "@/db/schema";

export const ORDER_STATUSES = orderStatusEnum.enumValues;

export const STATUS_LABELS: Record<(typeof ORDER_STATUSES)[number], string> = {
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const orderItemSchema = z.object({
  description: z.string().trim().min(1, "Describe el producto o servicio"),
  quantity: z.coerce.number<string | number>().int().min(1, "Mínimo 1"),
  unitPrice: z.coerce.number<string | number>().min(0, "No puede ser negativo"),
});

export const createOrderSchema = z.object({
  customerName: z.string().trim().min(2, "Indica el cliente"),
  customerPhone: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  dueAt: z.string().optional().or(z.literal("")),
  items: z.array(orderItemSchema).min(1, "Añade al menos una línea"),
});

export type CreateOrderInput = z.input<typeof createOrderSchema>;

export const updateStatusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(ORDER_STATUSES),
});
