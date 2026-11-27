"use server";

import { refresh } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, jobNotes, jobs, serviceTypes, type JobStatus } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail, invalid } from "@/lib/action-utils";
import { formatJobCode } from "@/lib/domain";
import { yearLima } from "@/lib/dates";
import { createJobFolders, DriveError, driveState, getSettings } from "@/lib/drive";
import { jobWarnings, nextSeq, resolveRootJob, type JobWarnings } from "@/lib/queries";
import { createJobSchema, noteSchema, statusSchema, updateJobSchema, type CreateJobInput, type UpdateJobInput } from "@/lib/validation/jobs";
import type { ActionResult } from "./result";

/** RF-35, RF-37 y RF-46: avisos mientras se llena el formulario. No impiden guardar. */
export async function checkJobWarnings(input: {
  clientId: string;
  serviceTypeId?: string;
  course?: string;
  professor?: string;
  academicTerm?: string;
}): Promise<JobWarnings | null> {
  await assertRole();
  if (!z.uuid().safeParse(input.clientId).success) return null;
  return jobWarnings({
    clientId: input.clientId,
    serviceTypeId: z.uuid().safeParse(input.serviceTypeId).success ? input.serviceTypeId : null,
    course: input.course,
    professor: input.professor,
    academicTerm: input.academicTerm,
  });
}

/** Intenta crear la carpeta en Drive; si falla, el trabajo queda creado igual y se avisa. */
async function tryCreateFolders(jobId: string): Promise<string | undefined> {
  try {
    const s = await getSettings();
    const state = driveState(s);
    if (state === "sin_conectar" || state === "sin_carpeta") return undefined;
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
      columns: { id: true, code: true, description: true, parentJobId: true },
      with: { client: { columns: { name: true } } },
    });
    if (job) await createJobFolders(job);
    return undefined;
  } catch (e) {
    console.error(e);
    return e instanceof DriveError ? e.message : "No se pudo crear la carpeta en Drive. Puedes crearla desde la ficha.";
  }
}

export type CreateJobResult = ActionResult<
  { kind: "created"; id: string; code: string; driveWarning?: string } | { kind: "confirm"; repeated: JobWarnings["repeated"] }
>;

export async function createJob(input: CreateJobInput): Promise<CreateJobResult> {
  try {
    const user = await assertRole();
    const parsed = createJobSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { confirmedNew, ...data } = parsed.data;

    const client = await db.query.clients.findFirst({ where: and(eq(clients.id, data.clientId), isNull(clients.deletedAt)) });
    if (!client) return { ok: false, error: "El cliente no existe o fue eliminado." };
    const type = await db.query.serviceTypes.findFirst({ where: eq(serviceTypes.id, data.serviceTypeId) });
    if (!type || !type.active) return { ok: false, error: "Ese tipo de servicio no está activo." };

    // RF-39: siempre al original, y solo del mismo cliente.
    let parentJobId: string | null = null;
    if (data.parentJobId) {
      parentJobId = await resolveRootJob(data.parentJobId, data.clientId);
      if (!parentJobId) return { ok: false, error: "Solo se puede relacionar con un trabajo del mismo cliente." };
    }

    // RF-37: preguntar si es un pedido nuevo o el mismo. Un relacionado es nuevo a propósito.
    if (!confirmedNew && !parentJobId) {
      const w = await jobWarnings({ clientId: data.clientId, serviceTypeId: data.serviceTypeId, course: data.course });
      if (w.repeated.length) return { ok: true, data: { kind: "confirm", repeated: w.repeated } };
    }

    const year = yearLima();
    const seq = await nextSeq(year);
    const code = formatJobCode(type.prefix, year, seq);
    const id = crypto.randomUUID();
    const values = {
      id,
      code,
      year,
      seq,
      ...data,
      parentJobId,
      correctionsCount: data.status === "correcciones" ? 1 : 0,
      deliveredAt: data.status === "entregado" ? new Date() : null,
      createdById: user.id,
    };
    await db.batch([
      db.insert(jobs).values(values),
      audit({ entity: "trabajo", entityId: id, jobId: id, action: "crear", after: { ...data, code, parentJobId }, userId: user.id }),
    ]);

    const driveWarning = await tryCreateFolders(id);
    refresh();
    return { ok: true, data: { kind: "created", id, code, driveWarning } };
  } catch (e) {
    return fail(e);
  }
}

const AUDITED_FIELDS = [
  "serviceTypeId",
  "course",
  "professor",
  "section",
  "academicTerm",
  "description",
  "dueDate",
  "urgency",
  "price",
  "responsableId",
] as const;

export async function updateJob(input: UpdateJobInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertRole();
    const parsed = updateJobSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...data } = parsed.data;
    const current = await db.query.jobs.findFirst({ where: and(eq(jobs.id, id), isNull(jobs.deletedAt)) });
    if (!current) return { ok: false, error: "El trabajo no existe o fue eliminado." };

    const priceChanged = (current.price === null ? null : Number(current.price)) !== (data.price === null ? null : Number(data.price));
    // Permisos 2.1: el empleado pone el primer precio (cotiza), pero cambiarlo o dar descuento es del admin.
    if (priceChanged && current.price !== null && user.role !== "admin") {
      return { ok: false, error: "Solo el admin puede cambiar el precio o dar un descuento.", fieldErrors: { price: ["Solo el admin"] } };
    }
    if (data.serviceTypeId !== current.serviceTypeId) {
      const type = await db.query.serviceTypes.findFirst({ where: eq(serviceTypes.id, data.serviceTypeId) });
      if (!type) return { ok: false, error: "Ese tipo de servicio no existe." };
      // RF-08: el código no cambia aunque cambie el tipo.
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const k of AUDITED_FIELDS) {
      const a = current[k] ?? null;
      const b = data[k] ?? null;
      if (String(a) !== String(b) && !(k === "price" && !priceChanged)) {
        before[k] = a;
        after[k] = b;
      }
    }
    if (!Object.keys(after).length) return { ok: true, data: { id } };

    const ops = [
      db.update(jobs).set(data).where(eq(jobs.id, id)),
      audit({ entity: "trabajo", entityId: id, jobId: id, action: priceChanged ? "precio" : "editar", before, after, userId: user.id }),
    ] as const;
    await db.batch(ops);
    refresh();
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e);
  }
}

/** RF-09 y RF-10: cambio de estado. Entrar en "Correcciones" suma una corrección. */
export async function changeJobStatus(input: { jobId: string; status: JobStatus }): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const { jobId, status } = statusSchema.parse(input);
    const current = await db.query.jobs.findFirst({ where: and(eq(jobs.id, jobId), isNull(jobs.deletedAt)) });
    if (!current) return { ok: false, error: "El trabajo no existe o fue eliminado." };
    if (current.status === status) return { ok: true };

    const correctionsCount = status === "correcciones" ? current.correctionsCount + 1 : current.correctionsCount;
    await db.batch([
      db
        .update(jobs)
        .set({ status, correctionsCount, deliveredAt: status === "entregado" ? new Date() : current.deliveredAt })
        .where(eq(jobs.id, jobId)),
      audit({ entity: "trabajo", entityId: jobId, jobId, action: "estado", before: current.status, after: status, userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-44: las notas se suman, no se editan. */
export async function addJobNote(input: { jobId: string; body: string }): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await db.insert(jobNotes).values({ ...parsed.data, authorId: user.id });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-29 */
export async function deleteJob(id: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const jobId = z.uuid().parse(id);
    await db.batch([
      db.update(jobs).set({ deletedAt: new Date(), deletedById: user.id }).where(eq(jobs.id, jobId)),
      audit({ entity: "trabajo", entityId: jobId, jobId, action: "eliminar", userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function restoreJob(id: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const jobId = z.uuid().parse(id);
    await db.batch([
      db.update(jobs).set({ deletedAt: null, deletedById: null }).where(eq(jobs.id, jobId)),
      audit({ entity: "trabajo", entityId: jobId, jobId, action: "restaurar", userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-23 y RF-31: crear (o volver a crear) la carpeta del trabajo en Drive. */
export async function createJobFolder(id: string): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const job = await db.query.jobs.findFirst({
      where: and(eq(jobs.id, z.uuid().parse(id)), isNull(jobs.deletedAt)),
      columns: { id: true, code: true, description: true, parentJobId: true, driveFolderId: true },
      with: { client: { columns: { name: true } } },
    });
    if (!job) return { ok: false, error: "El trabajo no existe." };
    const created = await createJobFolders(job);
    await audit({
      entity: "trabajo",
      entityId: job.id,
      jobId: job.id,
      action: job.driveFolderId ? "carpeta_recreada" : "carpeta_creada",
      before: job.driveFolderId,
      after: created.folderId,
      userId: user.id,
    });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Trabajos del cliente para elegir el relacionado (RF-39). */
export async function listClientJobs(clientId: string) {
  await assertRole();
  if (!z.uuid().safeParse(clientId).success) return [];
  const rows = await db.query.jobs.findMany({
    where: and(eq(jobs.clientId, clientId), isNull(jobs.deletedAt)),
    columns: { id: true, code: true, description: true, course: true, parentJobId: true, status: true },
    orderBy: (j, { desc }) => [desc(j.createdAt)],
    limit: 100,
  });
  return rows;
}

/** Datos del cliente para el formulario: preferencias (RF-38). */
export async function getClientForJob(clientId: string) {
  await assertRole();
  if (!z.uuid().safeParse(clientId).success) return null;
  const c = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), isNull(clients.deletedAt)),
    columns: { id: true, name: true, whatsapp: true, university: true, software: true, softwareVersion: true, usualFormat: true, preferredResponsableId: true },
  });
  return c ?? null;
}
