"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobFiles, jobs, payments } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/action-utils";
import { ensurePagosFolder, getFile, startResumableUpload, trashFile } from "@/lib/drive";
import type { ActionResult } from "./result";

const folderSchema = z.enum(["recibido", "avances", "entrega_final", "pagos"]);

async function targetFolder(jobId: string, folder: z.infer<typeof folderSchema>) {
  const job = await db.query.jobs.findFirst({ where: and(eq(jobs.id, jobId), isNull(jobs.deletedAt)) });
  if (!job) throw new Error("El trabajo no existe.");
  if (folder === "pagos") return ensurePagosFolder(jobId);
  const id = { recibido: job.driveRecibidoId, avances: job.driveAvancesId, entrega_final: job.driveEntregaFinalId }[folder];
  if (!id) throw new Error("El trabajo no tiene carpeta en Drive. Créala desde su ficha.");
  return id;
}

/**
 * RF-24 y RNF-08: abre una sesión de subida reanudable. El navegador sube el
 * archivo directo a Drive con la dirección que devuelve esta acción.
 */
export async function startUpload(input: {
  jobId: string;
  folder: string;
  name: string;
  size: number;
  mimeType: string;
}): Promise<ActionResult<{ uploadUrl: string }>> {
  try {
    await assertRole();
    const data = z
      .object({ jobId: z.uuid(), folder: folderSchema, name: z.string().min(1).max(250), size: z.number().int().positive(), mimeType: z.string().max(200) })
      .parse(input);
    const parentId = await targetFolder(data.jobId, data.folder);
    const h = await headers();
    const origin = h.get("origin") ?? `https://${h.get("host")}`;
    const uploadUrl = await startResumableUpload({ name: data.name, mimeType: data.mimeType, size: data.size, parentId, origin });
    return { ok: true, data: { uploadUrl } };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("El trabajo")) return { ok: false, error: e.message };
    return fail(e);
  }
}

/** Registra un archivo ya subido: se guarda solo su ID, enlace, nombre, tamaño, quién y cuándo. */
export async function registerUpload(input: {
  jobId: string;
  folder: string;
  driveFileId: string;
  paymentId?: string;
}): Promise<ActionResult> {
  try {
    const user = await assertRole();
    const data = z
      .object({ jobId: z.uuid(), folder: folderSchema, driveFileId: z.string().min(10).max(200), paymentId: z.uuid().optional() })
      .parse(input);
    const parentId = await targetFolder(data.jobId, data.folder);
    const file = await getFile(data.driveFileId);
    if (!file || !file.parents?.includes(parentId)) return { ok: false, error: "No se encontró el archivo subido en la carpeta del trabajo." };

    const id = crypto.randomUUID();
    const ops = [
      db.insert(jobFiles).values({
        id,
        jobId: data.jobId,
        paymentId: data.paymentId ?? null,
        folder: data.folder,
        driveFileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? Number(file.size) : null,
        webViewLink: file.webViewLink ?? null,
        uploadedById: user.id,
      }),
      audit({ entity: "archivo", entityId: id, jobId: data.jobId, action: "subir", after: { name: file.name, folder: data.folder }, userId: user.id }),
    ] as const;
    if (data.paymentId) {
      await db.batch([
        ...ops,
        db
          .update(payments)
          .set({ receiptFileId: file.id, receiptLink: file.webViewLink ?? null })
          .where(and(eq(payments.id, data.paymentId), eq(payments.jobId, data.jobId))),
      ]);
    } else {
      await db.batch(ops);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Borrar archivos es solo del admin. Va a la papelera de Drive (se recupera 30 días). */
export async function deleteJobFile(id: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const file = await db.query.jobFiles.findFirst({ where: and(eq(jobFiles.id, z.uuid().parse(id)), isNull(jobFiles.deletedAt)) });
    if (!file) return { ok: false, error: "El archivo no existe." };
    await trashFile(file.driveFileId);
    await db.batch([
      db.update(jobFiles).set({ deletedAt: new Date(), deletedById: user.id }).where(eq(jobFiles.id, file.id)),
      audit({ entity: "archivo", entityId: file.id, jobId: file.jobId, action: "eliminar", before: { name: file.name }, userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
