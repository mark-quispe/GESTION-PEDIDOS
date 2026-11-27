import { requireUser } from "@/lib/auth-guard";
import { lastViewedJob, listJobs } from "@/lib/queries/jobs";
import { PageBody } from "@/components/layout/page-header";
import { JobsBoard } from "@/components/jobs/jobs-board";

export const metadata = { title: "Trabajos" };

/** RF-12: lista de trabajos por estado y entrega, con filtros rápidos (distribución pedida por Mark, 27/11). */
export default async function TrabajosPage({ searchParams }: PageProps<"/trabajos">) {
  const user = await requireUser();
  const sp = await searchParams;
  const resp = typeof sp.resp === "string" ? sp.resp : null;
  const [rows, last] = await Promise.all([listJobs({ includeClosed: true }), lastViewedJob(user.id)]);
  const visible = resp ? rows.filter((r) => r.responsibleId === resp || r.externoId === resp) : rows;
  const respName = resp ? (rows.find((r) => r.responsibleId === resp)?.responsibleName ?? rows.find((r) => r.externoId === resp)?.externoName) : null;
  return (
    <PageBody className="md:pt-7">
      <JobsBoard
        rows={visible}
        canTake={user.canTake}
        last={last ? { code: last.code, title: last.title } : null}
        initialQ={typeof sp.q === "string" ? sp.q.slice(0, 80) : ""}
        respName={respName}
      />
    </PageBody>
  );
}
