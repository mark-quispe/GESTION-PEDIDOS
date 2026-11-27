import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, serviceTypes } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { PageHeader } from "@/components/layout/page-header";
import { ServiceTypesManager } from "@/components/admin/catalog-forms";

export const metadata: Metadata = { title: "Tipos de servicio" };

export default async function ServiceTypesPage() {
  await requireUser("admin");
  const rows = await db
    .select({ id: serviceTypes.id, name: serviceTypes.name, prefix: serviceTypes.prefix, active: serviceTypes.active, jobs: sql<number>`(select count(*) from ${jobs} j where j.service_type_id = ${serviceTypes.id})` })
    .from(serviceTypes)
    .orderBy(asc(serviceTypes.name));
  return (
    <>
      <PageHeader index="Administración" title="Tipos de servicio" description="El prefijo de dos letras encabeza el código de cada trabajo: PL26-014." />
      <ServiceTypesManager rows={rows.map((r) => ({ ...r, jobs: Number(r.jobs) }))} />
    </>
  );
}
