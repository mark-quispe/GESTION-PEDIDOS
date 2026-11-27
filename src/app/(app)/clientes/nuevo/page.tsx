import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-guard";
import { activeCatalogs } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { ClientForm } from "@/components/clients/client-form";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  await requireUser();
  const { responsables } = await activeCatalogs();
  return (
    <>
      <PageHeader index="Clientes / nuevo" title="Nuevo cliente" />
      <div className="max-w-3xl rounded-lg border bg-card p-6">
        <ClientForm responsables={responsables} />
      </div>
    </>
  );
}
