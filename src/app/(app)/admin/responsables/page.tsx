import type { Metadata } from "next";
import { asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, responsables } from "@/db/schema";
import { requireUser } from "@/lib/auth-guard";
import { PageHeader } from "@/components/layout/page-header";
import { ResponsablesManager } from "@/components/admin/catalog-forms";

export const metadata: Metadata = { title: "Responsables" };

export default async function ResponsablesPage() {
  await requireUser("admin");
  const rows = await db
    .select({
      id: responsables.id,
      name: responsables.name,
      contact: responsables.contact,
      active: responsables.active,
      open: sql<number>`(select count(*) from ${jobs} j where j.responsable_id = ${responsables.id} and j.deleted_at is null and j.status in ('confirmado','en_proceso','en_revision','correcciones'))`,
    })
    .from(responsables)
    .orderBy(asc(responsables.name));
  return (
    <>
      <PageHeader index="Administración" title="Responsables" description="Las personas que hacen los trabajos: el dueño o colaboradores externos. No tienen cuenta." />
      <ResponsablesManager rows={rows.map((r) => ({ ...r, open: Number(r.open) }))} />
    </>
  );
}
