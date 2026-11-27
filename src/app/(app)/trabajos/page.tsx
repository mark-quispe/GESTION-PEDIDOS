import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { lastViewedJob, listJobs } from "@/lib/queries/jobs";
import { PageBody } from "@/components/layout/page-header";
import { JobTable } from "@/components/jobs/job-list";
import { JobActionButtons } from "@/components/jobs/job-buttons";

export const metadata = { title: "Trabajos" };

/** RF-12: al entrar sin trabajo elegido, la lista ocupa toda la pantalla. */
export default async function TrabajosPage({ searchParams }: PageProps<"/trabajos">) {
  const user = await requireUser();
  const sp = await searchParams;
  const resp = typeof sp.resp === "string" ? sp.resp : null;
  const [rows, last] = await Promise.all([listJobs({ includeClosed: true }), lastViewedJob(user.id)]);
  const visible = resp ? rows.filter((r) => r.responsibleId === resp || r.externoId === resp) : rows;
  const respName = resp ? (rows.find((r) => r.responsibleId === resp)?.responsibleName ?? rows.find((r) => r.externoId === resp)?.externoName) : null;

  return (
    <PageBody className="gap-4 md:pt-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-[11px] text-muted">02 · Trabajos</p>
          <h1 className="text-[28px] font-medium tracking-[-0.02em]">Trabajos</h1>
        </div>
        {last && (
          <Link href={`/trabajos/${last.code}`} className="press group flex items-center gap-3 rounded-lg border bg-surface px-3 py-2 hover-fine:hover:border-border-strong">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[10.5px] text-muted">Seguir donde te quedaste</span>
              <span className="truncate text-[13px]">
                {last.code} · {last.title}
              </span>
            </span>
            <ChevronRight className="size-4 text-muted transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5" />
          </Link>
        )}
      </header>
      {respName && (
        <Link href="/trabajos" className="inline-flex h-[34px] items-center gap-2 self-start rounded-md border bg-surface px-3 text-[13px]">
          Solo de {respName} <span className="text-faint">· ver todos</span>
        </Link>
      )}
      <JobTable
        actions={<JobActionButtons />}
        rows={visible}
        initialQ={typeof sp.q === "string" ? sp.q.slice(0, 80) : ""}
        canTake={user.canTake}
        footer={<p className="hidden text-center text-xs text-faint md:block">Al elegir un trabajo se abre su ficha a todo el ancho y esta lista se esconde a la derecha (botón Trabajos).</p>}
      />
    </PageBody>
  );
}
