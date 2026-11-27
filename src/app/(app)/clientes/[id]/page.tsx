import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getClient } from "@/lib/queries/clients";
import { listJobs } from "@/lib/queries/jobs";
import { ClientDetail } from "@/components/clients/client-detail";

export const metadata = { title: "Cliente" };

/** RF-07: el historial del cliente, sus preferencias (RF-38) y observaciones (RF-45). */
export default async function ClientPage({ params }: PageProps<"/clientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await getClient(id);
  if (!c) notFound();
  const jobs = (await listJobs({ includeClosed: true })).filter((j) => j.clientId === id);
  const admin = user.isAdmin && !user.viewAsEmployee;
  // Responsable habitual: se calcula solo y solo lo ve el admin.
  const counts = new Map<string, number>();
  for (const j of jobs) if (j.responsibleName) counts.set(j.responsibleName, (counts.get(j.responsibleName) ?? 0) + 1);
  const usualPerson = admin ? ([...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) : null;
  return (
    <ClientDetail
      c={JSON.parse(JSON.stringify({ ...c, observations: c.observations.map((o) => ({ ...o, author: admin ? o.author : null })) }))}
      jobs={jobs}
      isAdmin={admin}
      usualPerson={usualPerson}
    />
  );
}
