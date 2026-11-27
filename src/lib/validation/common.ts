import { z } from "zod";

/** Texto opcional: "" se guarda como null. */
export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : null));

export const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

export const optionalDay = z
  .union([isoDay, z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));

/** Montos en soles con hasta dos decimales. */
export const money = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, "Escribe un monto válido, por ejemplo 350 o 350.50");

export const optionalMoney = z
  .union([money, z.literal("")])
  .optional()
  .transform((v) => (v ? v : null));
