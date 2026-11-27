import { z } from "zod";
import { normalizeWhatsapp } from "@/lib/domain";
import { optionalText, optionalUuid } from "./common";

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del cliente").max(120),
  whatsapp: z
    .string()
    .trim()
    .transform(normalizeWhatsapp)
    .refine((v) => v.length >= 9 && v.length <= 15, "Escribe un número de WhatsApp válido"),
  university: optionalText(120),
  career: optionalText(120),
  cycle: optionalText(20),
  source: optionalText(80),
  software: optionalText(80),
  softwareVersion: optionalText(40),
  usualFormat: optionalText(80),
  preferredResponsableId: optionalUuid,
  observations: optionalText(2000),
});

export type ClientInput = z.input<typeof clientSchema>;
export type ClientData = z.output<typeof clientSchema>;
