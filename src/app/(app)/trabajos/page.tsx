import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { activeCatalogs, listJobs } from "@/lib/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { JobsBrowser, type JobFilters } from "@/components/jobs/jobs-browser";

export const metadata: Metadata = { title: "Trabajos" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function JobsPage({ searchParams }: PageProps<"/trabajos">) {
  await requireUser();
  const sp = await searchParams;
  const [rows, { responsables }] = await Promise.all([listJobs(), activeCatalogs()]);
  const initial: JobFilters = {
    q: str(sp.q),
    estado: str(sp.estado),
    responsable: str(sp.responsable),
    urgencia: str(sp.urgencia),
    desde: str(sp.desde),
    hasta: str(sp.hasta),
    atrasados: str(sp.atrasados) === "1",
    saldo: str(sp.saldo) === "1",
    vista: str(sp.vista) === "tablero" ? "tablero" : "lista",
  };
  return (
    <>
      <PageHeader index="Trabajos" title="Trabajos" description="Filtra por estado, responsable, fecha y urgencia, o míralos en el tablero.">
        <Button asChild>
          <Link href="/trabajos/nuevo">
            <Plus /> Nuevo trabajo
          </Link>
        </Button>
      </PageHeader>
      <JobsBrowser data={rows} responsables={responsables.map(({ id, name }) => ({ id, name }))} initial={initial} />
    </>
  );
}
