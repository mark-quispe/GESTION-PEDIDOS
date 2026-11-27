import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { activeCatalogs } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/components/clients/client-form";

export const metadata: Metadata = { title: "Editar cliente" };

export default async function EditClientPage({ params }: PageProps<"/clientes/[id]/editar">) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [client, { responsables }] = await Promise.all([db.query.clients.findFirst({ where: and(eq(clients.id, id), isNull(clients.deletedAt)) }), activeCatalogs()]);
  if (!client) notFound();
  return (
    <>
      <PageHeader index="Clientes / editar" title={client.name} />
      <div className="max-w-3xl rounded-lg border bg-card p-6">
        <ClientForm clientId={client.id} initial={client} responsables={responsables} />
      </div>
    </>
  );
}
