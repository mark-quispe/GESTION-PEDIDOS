import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { allowedEmails } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddUserForm, RemoveUserButton, RoleSelect } from "@/components/admin/user-forms";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  await requireUser("admin");
  const list = await db.select().from(allowedEmails).orderBy(asc(allowedEmails.email));
  return (
    <>
      <PageHeader index="Administración" title="Usuarios y accesos" description="Solo los correos de esta lista pueden entrar con Google. Siempre queda al menos un administrador." />
      <div className="grid gap-6">
        <AddUserForm />
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="max-sm:hidden">Añadido por</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((u) => (
              <TableRow key={u.email}>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <RoleSelect key={u.role} email={u.email} role={u.role} />
                </TableCell>
                <TableCell className="text-muted-foreground max-sm:hidden">{u.addedBy ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <RemoveUserButton email={u.email} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
