import type { NextAuthConfig } from "next-auth";

/**
 * Configuración sin base de datos: la usa el proxy (src/proxy.ts) para
 * mandar a /entrar a quien no inició sesión. La validación real de rol se hace
 * en el servidor (src/lib/auth-guard.ts) en cada página y Server Action.
 */
export const authConfig = {
  providers: [],
  pages: { signIn: "/entrar", error: "/entrar" },
  // RNF-13: la sesión vence a los 30 días.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isEntry = request.nextUrl.pathname.startsWith("/entrar");
      if (isEntry) return isLoggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.demo = (user as { demo?: boolean }).demo ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      (session as { demo?: boolean }).demo = !!token.demo;
      return session;
    },
  },
} satisfies NextAuthConfig;
