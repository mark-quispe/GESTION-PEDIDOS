import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, type Role } from "@/db/schema";

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: Role;
};

/**
 * Lee la sesión y vuelve a consultar el usuario en la BD, así un cambio de rol
 * o una baja surten efecto al instante aunque el JWT siga vigente.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
});

/** Para páginas: redirige a /login si no hay usuario o el rol no alcanza. */
export async function requireUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (role === "admin" && user.role !== "admin") redirect("/");
  return user;
}

export class AuthError extends Error {}

/** Para Server Actions: lanza error en vez de redirigir. Úsalo al inicio de cada acción. */
export async function assertRole(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("No has iniciado sesión.");
  if (role === "admin" && user.role !== "admin") throw new AuthError("Solo un administrador puede hacer esto.");
  return user;
}
