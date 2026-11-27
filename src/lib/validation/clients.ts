import { z } from "zod";
import { phoneSchema } from "@/lib/validation/jobs";

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

/** RF-05: datos del cliente. */
export const clientSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(120),
  whatsapp: phoneSchema,
  university: opt(80),
  career: opt(80),
  cycle: z.coerce.number().int().min(1).max(10).optional().nullable(),
  source: opt(60),
});
export type ClientInput = z.input<typeof clientSchema>;
