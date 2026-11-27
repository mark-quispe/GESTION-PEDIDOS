import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getJobByCode, jobHistory, listJobs, touchJobView } from "@/lib/queries/jobs";
import { listExternos } from "@/lib/queries/catalog";
import { getSettings } from "@/lib/settings";
import { isDriveReady } from "@/lib/drive-status";
import { JobFile } from "@/components/jobs/job-file";

export async function generateMetadata({ params }: PageProps<"/trabajos/[code]">) {
  const { code } = await params;
  return { title: code.toUpperCase() };
}

/** Ficha del trabajo a todo el ancho; la lista se esconde a la derecha (RF-12). */
export default async function JobPage({ params }: PageProps<"/trabajos/[code]">) {
  const user = await requireUser();
  const { code } = await params;
  const job = await getJobByCode(decodeURIComponent(code));
  if (!job) notFound();
  const [history, rows, externos, settings, lastSeen] = await Promise.all([
    jobHistory(job.id),
    listJobs({ includeClosed: true }),
    listExternos(),
    getSettings(),
    touchJobView(user.id, job.id),
  ]);

  // El historial lo ve solo el admin (pedido de Mark, 27/11). Al empleado solo le llegan las fechas de los pasos.
  const admin = user.isAdmin && !user.viewAsEmployee;
  const steps = ["confirmó la cotización", "lo marcó terminado", "terminó la corrección"];
  const visibleHistory = admin
    ? history
    : history.filter((h) => steps.some((k) => h.summary?.includes(k))).map((h) => ({ ...h, userName: null, before: null, after: null }));

  return (
    <JobFile
      job={JSON.parse(JSON.stringify(job))}
      history={visibleHistory.map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }))}
      rows={rows}
      externos={externos.map((e) => ({ id: e.id, name: e.name }))}
      me={{ id: user.id, name: user.name, isAdmin: user.isAdmin && !user.viewAsEmployee, canTake: user.canTake }}
      urgency={settings.urgency}
      lastSeen={lastSeen?.toISOString() ?? null}
      driveReady={isDriveReady(settings)}
      studio={{ name: settings.studioName, whatsapp: settings.whatsapp, facebook: settings.facebook, instagram: settings.instagram, logoUrl: settings.logoUrl }}
    />
  );
}
