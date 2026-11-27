import "server-only";
import { z } from "zod";
import { AuthError } from "@/lib/auth-guard";
import { DriveError } from "@/lib/drive";
import type { ActionResult } from "@/actions/result";

/** Error con un mensaje pensado para el usuario. */
export class UserError extends Error {}

export function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof AuthError || e instanceof UserError || e instanceof DriveError) return { ok: false, error: e.message };
  console.error(e);
  return { ok: false, error: "Ha ocurrido un error. Inténtalo de nuevo." };
}

export function invalid(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Revisa los campos",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
  };
}
