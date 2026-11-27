import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, ilike, isNull, or, sql } from "drizzle-orm";
import { Plus, Search } from "lucide-react";
import { db } from "@/db";
import { clients, jobs } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { formatWhatsapp } from "@/lib/domain";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({ searchParams }: PageProps<"/clientes">) {
  await requireUser();
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.trim() : "";
  const digits = q.replace(/\D/g, "");
  // RF-06: por nombre o por número.
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      whatsapp: clients.whatsapp,
      university: clients.university,
      career: clients.career,
      jobsCount: sql<number>`(select count(*) from ${jobs} j where j.client_id = ${clients.id} and j.deleted_at is null)`,
    })
    .from(clients)
    .where(and(isNull(clients.deletedAt), q ? or(ilike(clients.name, `%${q}%`), digits.length >= 3 ? ilike(clients.whatsapp, `%${digits}%`) : undefined) : undefined))
    .orderBy(asc(clients.name))
    .limit(500);

  return (
    <>
      <PageHeader index="Clientes" title="Clientes" description="Busca por nombre o por WhatsApp. Cada número es un solo cliente.">
        <Button asChild>
          <Link href="/clientes/nuevo">
            <Plus /> Nuevo cliente
          </Link>
        </Button>
      </PageHeader>
      <form className="mb-4 flex gap-2" role="search">
        <label className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q} aria-label="Buscar cliente" placeholder="Nombre o WhatsApp" className="pl-9" />
        </label>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Cliente</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead className="max-md:hidden">Universidad · carrera</TableHead>
            <TableHead className="text-right">Trabajos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <Link href={`/clientes/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                  {c.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{formatWhatsapp(c.whatsapp)}</TableCell>
              <TableCell className="text-muted-foreground max-md:hidden">{[c.university, c.career].filter(Boolean).join(" · ") || "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{Number(c.jobsCount)}</TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                {q ? "Nadie coincide con la búsqueda." : "Todavía no hay clientes."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
