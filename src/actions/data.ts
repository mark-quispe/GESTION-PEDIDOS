"use server";

import { refresh } from "next/cache";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { imports } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/action-utils";
import { sha256 } from "@/lib/crypto";
import { applyPlan, buildPlan, exportToDrive, runBackup, type PlanItem } from "@/lib/data-io";
import { driveState, exportSheetAsXlsx, getSettings } from "@/lib/drive";
import { readWorkbook } from "@/lib/sheets";
import type { ActionResult } from "./result";

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
});

/** RF-27: exportar como Google Sheets en el Drive del admin. */
export async function exportToSheets(input: { from?: string; to?: string }): Promise<ActionResult<{ link: string | null; name: string }>> {
  try {
    const user = await assertRole("admin");
    const range = rangeSchema.parse(input);
    const file = await exportToDrive({ from: range.from || null, to: range.to || null });
    await audit({ entity: "configuracion", entityId: "exportacion", action: "exportar", after: { ...range, archivo: file.name }, userId: user.id });
    return { ok: true, data: { link: file.webViewLink ?? null, name: file.name } };
  } catch (e) {
    return fail(e);
  }
}

/** Respaldo a pedido, además del diario. */
export async function backupNow(): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    await runBackup();
    await audit({ entity: "configuracion", entityId: "respaldo", action: "respaldo_manual", userId: user.id });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

type Mode = "planilla" | "contingencia";

async function readSource(formData: FormData) {
  const mode = z.enum(["planilla", "contingencia"]).parse(formData.get("mode")) as Mode;
  const driveFileId = formData.get("driveFileId");
  const file = formData.get("file");
  let data: Buffer;
  let fileName: string;
  let fileId: string | null = null;
  if (typeof driveFileId === "string" && driveFileId) {
    // RF-28 y RF-34: el archivo se eligió con el Picker, que da el permiso de lectura.
    fileId = driveFileId;
    data = await exportSheetAsXlsx(driveFileId);
    fileName = String(formData.get("fileName") || "Planilla de Google");
  } else if (file instanceof File && file.size > 0) {
    if (mode === "contingencia") throw new Error("La planilla de contingencia se elige desde Drive.");
    if (file.size > 4 * 1024 * 1024) throw new Error("El archivo pesa más de 4 MB.");
    data = Buffer.from(await file.arrayBuffer());
    fileName = file.name;
  } else {
    throw new Error("Elige un archivo.");
  }
  const headerRow = {};
  const sheets = await readWorkbook(data, headerRow);
  return { mode, data, fileName, fileId, sheets, hash: sha256(data) };
}

export type ImportPreview = { items: PlanItem[]; errors: number; valid: number; fileName: string; alreadyImported: boolean };

async function alreadyImported(mode: Mode, hash: string, fileId: string | null) {
  const found = await db.query.imports.findFirst({
    where: mode === "contingencia" && fileId ? or(eq(imports.contentHash, hash), eq(imports.driveFileId, fileId)) : eq(imports.contentHash, hash),
  });
  return !!found;
}

export async function previewImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  try {
    await assertRole("admin");
    const src = await readSource(formData);
    const plan = await buildPlan(src.sheets, src.mode);
    return {
      ok: true,
      data: {
        items: plan.items,
        errors: plan.errors,
        valid: plan.ops.length,
        fileName: src.fileName,
        alreadyImported: await alreadyImported(src.mode, src.hash, src.fileId),
      },
    };
  } catch (e) {
    if (e instanceof Error && /^(Elige|El archivo|La planilla)/.test(e.message)) return { ok: false, error: e.message };
    return fail(e);
  }
}

export async function applyImport(formData: FormData): Promise<ActionResult<{ created: Record<string, number>; folderErrors: string[] }>> {
  try {
    const user = await assertRole("admin");
    const src = await readSource(formData);
    // RF-34: un archivo ya importado se rechaza, para que nada se duplique.
    if (await alreadyImported(src.mode, src.hash, src.fileId)) return { ok: false, error: "Este archivo ya fue importado." };
    const plan = await buildPlan(src.sheets, src.mode);
    if (!plan.ops.length) return { ok: false, error: "No hay filas válidas para importar." };

    // Se registra primero: si dos personas importan a la vez, la huella única frena a la segunda.
    const importId = crypto.randomUUID();
    await db.insert(imports).values({ id: importId, kind: src.mode, driveFileId: src.fileId, fileName: src.fileName, contentHash: src.hash, importedById: user.id });

    const s = await getSettings();
    const result = await applyPlan(plan, {
      userId: user.id,
      source: src.mode === "contingencia" ? "contingencia" : "importacion",
      createFolders: src.mode === "contingencia" && driveState(s) === "conectado",
    });
    await db.batch([
      db.update(imports).set({ summary: { ...result, skipped: plan.errors } }).where(eq(imports.id, importId)),
      audit({ entity: "importacion", entityId: importId, action: src.mode, after: { archivo: src.fileName, ...result.created, omitidas: plan.errors }, userId: user.id, source: src.mode === "contingencia" ? "contingencia" : "importacion" }),
    ]);
    refresh();
    return { ok: true, data: result };
  } catch (e) {
    if (e instanceof Error && /^(Elige|El archivo|La planilla)/.test(e.message)) return { ok: false, error: e.message };
    return fail(e);
  }
}
