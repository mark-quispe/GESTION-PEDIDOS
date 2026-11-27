import { z } from "zod";

/** Reglas compartidas: validan el formulario en pantalla y la Server Action (RNF-17). */

const money = z.coerce.number({ error: "Escribe un monto" }).min(0, "No puede ser negativo").max(1_000_000, "Revisa el monto");
const positive = z.coerce.number({ error: "Escribe un monto" }).gt(0, "Debe ser mayor que 0").max(1_000_000, "Revisa el monto");
const optText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

export const methodSchema = z.enum(["yape", "plin", "transferencia", "efectivo"], { error: "Elige el medio" });
export const urgencySchema = z.enum(["normal", "alta", "urgente"]);
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha");
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Elige la hora");

export const phoneSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, "").replace(/^51(?=\d{9}$)/, ""))
  .refine((s) => /^9\d{8}$/.test(s), "El celular tiene 9 dígitos y empieza con 9");

export const newClientSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(120),
  whatsapp: phoneSchema,
  university: optText(80),
  career: optText(80),
  cycle: z.coerce.number().int().min(1).max(10).optional().nullable(),
});

export const lineSchema = z.object({
  serviceItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Mínimo 1").max(999),
  /** RF-68: solo para Personalizado. */
  detail: optText(1000),
  customPrice: money.optional(),
  hours: z.coerce.number().min(0).max(999).optional(),
  /** Al editar: ítem que ya existe en el trabajo. */
  jobItemId: z.string().uuid().optional(),
});

export const advanceSchema = z.object({
  amount: positive,
  method: methodSchema,
  operationNumber: optText(40),
});

export const createJobSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    newClient: newClientSchema.optional(),
    cycle: z.coerce.number({ error: "Elige el ciclo" }).int().min(1, "Elige el ciclo").max(10),
    course: optText(120),
    professor: optText(120),
    section: optText(40),
    title: z.string().trim().min(3, "Escribe qué pide").max(500),
    items: z.array(lineSchema).min(1, "Agrega al menos un ítem del tarifario"),
    complexityExtra: money.default(0),
    dueDate: daySchema,
    dueTime: timeSchema,
    urgency: urgencySchema,
    initialStatus: z.enum(["cotizacion", "confirmado"]),
    advance: advanceSchema.optional(),
    who: z.enum(["pozo", "yo", "externo"]).default("pozo"),
    externoId: z.string().uuid().optional(),
    continuesJobId: z.string().uuid().optional(),
    software: optText(120),
    deliveryFormat: optText(120),
  })
  .refine((v) => v.clientId || v.newClient, { message: "Elige o registra al cliente", path: ["clientId"] })
  .refine((v) => v.who !== "externo" || v.externoId, { message: "Elige al externo", path: ["externoId"] })
  .refine((v) => v.items.every((i) => i.customPrice === undefined || (i.detail && i.detail.length >= 3)), {
    message: "Describe el pedido personalizado",
    path: ["items"],
  });
export type CreateJobInput = z.input<typeof createJobSchema>;

export const releaseSchema = z.object({ jobId: z.string().uuid(), note: optText(1000) });

export const correctionSchema = z
  .object({
    jobId: z.string().uuid(),
    request: z.string().trim().min(3, "Escribe qué pidió corregir").max(1000),
    newDueDate: daySchema,
    newDueTime: timeSchema,
    charge: z.enum(["incluida", "se_cobra", "error_estudio", "extra"]),
    whatFailed: optText(500),
    amount: money.optional(),
    paidNow: z.boolean().default(false),
    method: methodSchema.optional(),
    operationNumber: optText(40),
    who: z.enum(["pozo", "yo", "externo"]),
    externoId: z.string().uuid().optional(),
  })
  .refine((v) => !["se_cobra", "extra"].includes(v.charge) || (v.amount ?? 0) > 0, { message: "Escribe el monto", path: ["amount"] })
  .refine((v) => v.charge !== "error_estudio" || !!v.whatFailed, { message: "Cuenta qué falló", path: ["whatFailed"] })
  .refine((v) => !v.paidNow || !!v.method, { message: "Elige el medio", path: ["method"] })
  .refine((v) => v.who !== "externo" || v.externoId, { message: "Elige al externo", path: ["externoId"] });
export type CorrectionInput = z.input<typeof correctionSchema>;

export const editJobSchema = z.object({
  jobId: z.string().uuid(),
  urgency: urgencySchema,
  items: z.array(lineSchema).min(1, "Debe quedar al menos un ítem"),
  complexityExtra: money.default(0),
  discount: money.default(0),
  dueDate: daySchema.optional(),
  dueTime: timeSchema.optional(),
  course: optText(120),
  professor: optText(120),
  section: optText(40),
  title: z.string().trim().min(3, "Escribe qué pide").max(500),
  externoId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(3, "El motivo es obligatorio").max(500),
});
export type EditJobInput = z.input<typeof editJobSchema>;

export const paymentSchema = z.object({
  jobId: z.string().uuid({ error: "Elige el trabajo" }),
  amount: positive,
  method: methodSchema,
  paidDate: daySchema,
  operationNumber: optText(40),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export const refundSchema = z.object({
  jobId: z.string().uuid(),
  amount: positive,
  method: methodSchema,
  paidDate: daySchema,
  operationNumber: optText(40),
  reasonKind: z.enum(["cancelo", "quito_item", "pago_de_mas", "otro"], { error: "Elige el motivo" }),
  reasonNote: optText(500),
  cancelJob: z.boolean().default(false),
});
export type RefundInput = z.input<typeof refundSchema>;

export const REFUND_REASON: Record<z.infer<typeof refundSchema>["reasonKind"], string> = {
  cancelo: "Canceló el trabajo",
  quito_item: "Quitó un ítem",
  pago_de_mas: "Pagó de más",
  otro: "Otro",
};

export const cancelSchema = z
  .object({
    jobId: z.string().uuid(),
    reasonKind: z.enum(["no_pago", "desaparecio", "cliente_cancelo", "otro"], { error: "Elige el motivo" }),
    note: optText(500),
    refund: z.boolean().default(false),
    amount: money.optional(),
    method: methodSchema.optional(),
    paidDate: daySchema.optional(),
    operationNumber: optText(40),
  })
  .refine((v) => !v.refund || ((v.amount ?? 0) > 0 && !!v.method), { message: "Escribe el monto y el medio de la devolución", path: ["amount"] });
export type CancelInput = z.input<typeof cancelSchema>;

export const CANCEL_REASON: Record<z.infer<typeof cancelSchema>["reasonKind"], string> = {
  no_pago: "No pagó el adelanto",
  desaparecio: "Pagó y desapareció",
  cliente_cancelo: "El cliente lo canceló",
  otro: "Otro",
};

export const noteSchema = z.object({ jobId: z.string().uuid(), body: z.string().trim().min(2, "Escribe el apunte").max(2000) });
