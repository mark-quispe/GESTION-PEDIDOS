import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { PageBody } from "@/components/layout/page-header";
import { UsersBoard } from "@/components/admin/users-board";

export const metadata = { title: "Usuarios" };

/** RF-04: quién puede entrar a la app y con qué rol (solo admin). */
export default async function UsersPage() {
  const me = await requireUser("admin");
  const rows = await db.select().from(users).orderBy(asc(users.createdAt));
  return (
    <PageBody>
      <header className="[&_*]:leading-[normal]">
        <p className="font-mono text-[11px] text-muted">06 · Usuarios</p>
        <h1 className="mt-2 mb-1 text-[32px] leading-tight font-medium tracking-[-0.025em]">Usuarios</h1>
        <p className="text-sm text-muted">Quién puede entrar a la app y con qué rol.</p>
      </header>
      <UsersBoard
        meId={me.id}
        rows={rows.map((u) => ({ id: u.id, name: u.name, email: u.email, roles: u.roles as never, active: u.active, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }))}
      />
    </PageBody>
  );
}
