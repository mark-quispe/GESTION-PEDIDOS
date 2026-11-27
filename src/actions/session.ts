"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError as NextAuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { assertRole, VIEW_COOKIE } from "@/lib/auth-guard";

/** RF-03: el admin ve la app como empleado (o vuelve). Solo cambia la vista. */
export async function setViewAsEmployee(on: boolean) {
  await assertRole("admin");
  const jar = await cookies();
  if (on) jar.set(VIEW_COOKIE, "empleado", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  else jar.delete(VIEW_COOKIE);
}

export async function logout() {
  (await cookies()).delete(VIEW_COOKIE);
  await signOut({ redirectTo: "/entrar" });
}

export async function enterWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

/** RF-53: entra como administrador del estudio ficticio. */
export async function enterDemo() {
  try {
    await signIn("demo", { redirectTo: "/" });
  } catch (e) {
    if (e instanceof NextAuthError) redirect("/entrar?error=demo");
    throw e;
  }
}

/** Solo desarrollo: entrar como una de las personas de prueba. */
export async function enterDev(formData: FormData) {
  try {
    await signIn("dev", { email: String(formData.get("email") ?? ""), redirectTo: "/" });
  } catch (e) {
    if (e instanceof NextAuthError) redirect("/entrar?error=dev");
    throw e;
  }
}
