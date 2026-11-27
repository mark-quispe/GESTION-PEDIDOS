import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, allowedEmails, sessions, users, verificationTokens } from "@/db/schema";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    ...authConfig.callbacks,
    /** Solo entran correos de la lista permitida. */
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const allowed = await db.query.allowedEmails.findFirst({
        where: eq(allowedEmails.email, email),
      });
      return !!allowed;
    },
  },
  events: {
    /** Copia el rol de la lista permitida al usuario cada vez que entra. */
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email || !user.id) return;
      const allowed = await db.query.allowedEmails.findFirst({
        where: eq(allowedEmails.email, email),
      });
      if (allowed) {
        await db.update(users).set({ role: allowed.role }).where(eq(users.id, user.id));
      }
    },
  },
});
