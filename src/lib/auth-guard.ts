import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, dbReady } from "@/db";
import { users, type Role } from "@/db/schema";
import { canTake, isAdmin } from "@/lib/domain";

export const VIEW_COOKIE = "vista";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** Roles reales: los que cuentan en el servidor. */
  roles: Role[];
  /** Roles con los que se dibuja la pantalla (el admin puede ver como empleado, RF-03). */
  viewRoles: Role[];
  isAdmin: boolean;
  viewAsEmployee: boolean;
  canTake: boolean;
  demo: boolean;
};

/**
 * Lee la sesión y vuelve a consultar el usuario en la BD (RNF-13), así un cambio
 * de rol o una baja surten efecto al instante aunque la sesión siga vigente.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await dbReady();
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user || !user.active) return null;
  const roles = user.roles as Role[];
  const admin = isAdmin(roles);
  const viewAsEmployee = admin && (await cookies()).get(VIEW_COOKIE)?.value === "empleado";
  const viewRoles: Role[] = viewAsEmployee ? ["empleado", "produccion"] : roles;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    roles,
    viewRoles,
    isAdmin: admin,
    viewAsEmployee,
    canTake: canTake(roles),
    demo: !!(session as { demo?: boolean }).demo,
  };
});

/** Para páginas: manda a /entrar si no hay usuario, y al Inicio si el rol no alcanza. */
export async function requireUser(need?: "admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (need === "admin" && (!user.isAdmin || user.viewAsEmployee)) redirect("/");
  return user;
}

export class AuthError extends Error {}

/**
 * Para Server Actions (RNF-04, RNF-14): lanza error en vez de redirigir.
 * Úsalo al inicio de cada acción. "tomar" = Producción o admin.
 */
export async function assertRole(need?: "admin" | "tomar"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Tu sesión terminó. Vuelve a entrar.");
  if (need === "admin" && !user.isAdmin) throw new AuthError("Solo un administrador puede hacer esto.");
  if (need === "tomar" && !user.canTake) throw new AuthError("Solo quien tiene el rol Producción puede tomar trabajos.");
  return user;
}
