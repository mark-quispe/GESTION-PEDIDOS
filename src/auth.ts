import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { auditLog, users } from "@/db/schema";
import { authConfig } from "./auth.config";

/** Acceso de prueba: solo en desarrollo o si se enciende a propósito (nunca en producción real). */
export const devLoginEnabled = process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_LOGIN === "1";
/** RF-53 y RNF-20: la demo tiene su interruptor. */
export const demoEnabled = process.env.DEMO_ENABLED !== "0";
export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const SIN_ACCESO_COOKIE = "sin_acceso";

async function findActive(email: string) {
  await dbReady();
  const u = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  return u?.active ? u : null;
}

async function logLogin(userId: string, how: string) {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  await db.insert(auditLog).values({ entity: "sesion", entityId: userId, action: "entrar", summary: how, userId });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    // RF-01: solo nombre y correo. El permiso de Drive es aparte (RF-22).
    ...(googleEnabled ? [Google] : []),
    Credentials({
      id: "dev",
      name: "Acceso de prueba",
      credentials: { email: {} },
      async authorize(c) {
        if (!devLoginEnabled || typeof c?.email !== "string") return null;
        const u = await findActive(c.email);
        if (!u) return null;
        await logLogin(u.id, "acceso de prueba");
        return { id: u.id, name: u.name, email: u.email };
      },
    }),
    Credentials({
      id: "demo",
      name: "Demo",
      credentials: {},
      async authorize() {
        if (!demoEnabled) return null;
        // La demo entra como administrador del estudio ficticio (RF-53).
        const u = await findActive("mark@estudio.test");
        if (!u) return null;
        return { id: u.id, name: u.name, email: u.email, demo: true };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    /** RF-02: solo entran los correos que el admin autorizó. */
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.toLowerCase();
      const u = email ? await findActive(email) : null;
      if (!u) {
        (await cookies()).set(SIN_ACCESO_COOKIE, email ?? "", { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
        return "/entrar?error=sin-acceso";
      }
      user.id = u.id;
      if (!u.image && user.image) await db.update(users).set({ image: user.image }).where(eq(users.id, u.id));
      await logLogin(u.id, "Google");
      return true;
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google") {
        // El id de Google no es el nuestro: se busca por correo.
        const u = user.email ? await findActive(user.email) : null;
        token.uid = u?.id;
        token.demo = false;
        return token;
      }
      return authConfig.callbacks.jwt({ token, user });
    },
  },
});
