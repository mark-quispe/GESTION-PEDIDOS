"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { jobs, clients } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { getTarifario, listExternos, type TarifaItem } from "@/lib/queries/catalog";
import { getSettings } from "@/lib/settings";
import { isDriveReady } from "@/lib/drive-status";
import type { UrgencyConfig } from "@/db/schema";

export type NewJobData = {
  tarifario: TarifaItem[];
  urgency: UrgencyConfig;
  cycleFactors: Record<string, number>;
  externos: { id: string; name: string; skills: string[] }[];
  canTake: boolean;
  nextCodeHint: string;
  driveReady: boolean;
  studio: { name: string; whatsapp: string | null; facebook: string | null; instagram: string | null; logoUrl?: string | null };
};

/** Lo que necesita la ventana Nuevo trabajo. Se pide al abrirla, no en cada página. */
export async function getNewJobData(): Promise<NewJobData> {
  const user = await assertRole();
  const [tarifario, s, ext] = await Promise.all([getTarifario(), getSettings(), listExternos()]);
  return {
    tarifario,
    urgency: s.urgency,
    cycleFactors: s.cycleFactors,
    externos: ext.map((e) => ({ id: e.id, name: e.name, skills: e.skills })),
    canTake: user.canTake,
    nextCodeHint: "",
    driveReady: isDriveReady(s),
    studio: { name: s.studioName, whatsapp: s.whatsapp, facebook: s.facebook, instagram: s.instagram, logoUrl: s.logoUrl },
  };
}

export type JobPick = { id: string; code: string; title: string; clientName: string; dueAt: string; price: number };

/** Buscador de trabajo en Registrar pago (código o cliente). */
export async function searchOpenJobs(q: string): Promise<JobPick[]> {
  await assertRole();
  const term = q.trim().toLowerCase();
  const rows = await db
    .select({ id: jobs.id, code: jobs.code, title: jobs.title, clientName: clients.name, dueAt: jobs.dueAt, price: jobs.price })
    .from(jobs)
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .where(and(isNull(jobs.deletedAt), ne(jobs.status, "cancelado")))
    .limit(400);
  return rows
    .filter((r) => !term || `${r.code} ${r.clientName} ${r.title}`.toLowerCase().includes(term))
    .slice(0, 8)
    .map((r) => ({ ...r, dueAt: r.dueAt.toISOString() }));
}
