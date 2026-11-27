import { z } from "zod";
import { optionalText } from "./common";

export const serviceTypeSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Escribe el nombre del servicio").max(60),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "El prefijo son dos letras, por ejemplo PL"),
});

export const responsableSchema = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Escribe el nombre").max(80),
  contact: optionalText(120),
});

export const codeStartSchema = z.object({
  codeStart: z.coerce.number<string>().int().min(1, "Mínimo 1").max(9000, "Demasiado alto"),
});
