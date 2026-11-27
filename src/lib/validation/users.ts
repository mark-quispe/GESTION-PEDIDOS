import { z } from "zod";

export const allowedEmailSchema = z.object({
  email: z.email("Correo no válido").transform((e) => e.toLowerCase().trim()),
  role: z.enum(["admin", "empleado"]),
});
