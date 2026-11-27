import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { activeCatalogs } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { JobForm } from "@/components/jobs/job-form";

export const metadata: Metadata = { title: "Nuevo trabajo" };

const UUID = /^[0-9a-f-]{36}$/;

export default async function NewJobPage({ searchParams }: PageProps<"/trabajos/nuevo">) {
  const user = await requireUser();
  const sp = await searchParams;
  const clientId = typeof sp.cliente === "string" && UUID.test(sp.cliente) ? sp.cliente : null;
  const parentId = typeof sp.relacionado === "string" && UUID.test(sp.relacionado) ? sp.relacionado : undefined;
  const [catalogs, client] = await Promise.all([
    activeCatalogs(),
    clientId
      ? db.query.clients.findFirst({
          where: and(eq(clients.id, clientId), isNull(clients.deletedAt)),
          columns: { id: true, name: true, whatsapp: true, university: true, software: true, softwareVersion: true, usualFormat: true, preferredResponsableId: true },
        })
      : null,
  ]);

  if (!catalogs.serviceTypes.some((t) => t.active)) {
    return (
      <>
        <PageHeader title="Nuevo trabajo" />
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          Antes de crear trabajos hay que definir los tipos de servicio y su prefijo de dos letras.{" "}
          {user.role === "admin" ? (
            <Link href="/admin/servicios" className="text-foreground underline underline-offset-4">
              Crear tipos de servicio
            </Link>
          ) : (
            "Pídeselo al admin."
          )}
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        index="Trabajos / nuevo"
        title={parentId ? "Nuevo trabajo relacionado" : "Nuevo trabajo"}
        description="El código se asigna solo al guardar: prefijo del tipo, año y número."
      />
      <JobForm
        mode="crear"
        serviceTypes={catalogs.serviceTypes}
        responsables={catalogs.responsables}
        initialClient={client ?? null}
        initialParentId={parentId}
        canEditPrice
      />
    </>
  );
}
