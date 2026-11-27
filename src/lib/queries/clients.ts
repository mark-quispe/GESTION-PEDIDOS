import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { clientObservations, clients, users } from "@/db/schema";
import { round2 } from "@/lib/domain";
import { listJobs, type JobRow } from "@/lib/queries/jobs";

export type ClientRow = {
  id: string;
  name: string;
  whatsapp: string;
  university: string | null;
  career: string | null;
  jobs: number;
  open: number;
  pending: number;
  paid: number;
  lastOrder: string | null;
};

/** RF-06 y RF-07: clientes con sus trabajos y lo que deben. */
export async function listClients(): Promise<{ rows: ClientRow[]; jobs: JobRow[] }> {
  const [cs, jobs] = await Promise.all([
    db.select().from(clients).where(isNull(clients.deletedAt)).orderBy(asc(clients.name)),
    listJobs({ includeClosed: true }),
  ]);
  const byClient = new Map<string, JobRow[]>();
  for (const j of jobs) byClient.set(j.clientId, [...(byClient.get(j.clientId) ?? []), j]);
  const rows = cs.map((c) => {
    const js = byClient.get(c.id) ?? [];
    const billable = js.filter((j) => j.status !== "cancelado" && j.status !== "cotizacion");
    return {
      id: c.id,
      name: c.name,
      whatsapp: c.whatsapp,
      university: c.university,
      career: c.career,
      jobs: js.length,
      open: js.filter((j) => !["finalizado", "cancelado", "cotizacion"].includes(j.status)).length,
      pending: round2(billable.reduce((a, j) => a + j.pending, 0)),
      paid: round2(js.reduce((a, j) => a + j.paid, 0)),
      lastOrder: js.map((j) => j.createdAt).sort().at(-1) ?? null,
    };
  });
  return { rows, jobs };
}

export async function getClient(id: string) {
  const c = await db.query.clients.findFirst({ where: and(eq(clients.id, id), isNull(clients.deletedAt)) });
  if (!c) return null;
  const observations = await db
    .select({ id: clientObservations.id, body: clientObservations.body, kind: clientObservations.kind, alert: clientObservations.alertOnNewJob, createdAt: clientObservations.createdAt, author: users.name })
    .from(clientObservations)
    .leftJoin(users, eq(users.id, clientObservations.authorId))
    .where(eq(clientObservations.clientId, id))
    .orderBy(desc(clientObservations.createdAt));
  return { ...c, observations };
}
