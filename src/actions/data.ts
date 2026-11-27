"use server";

import { revalidatePath } from "next/cache";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { db, batch } from "@/db";
import { imports } from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail, UserError } from "@/lib/action-utils";
import { sha256 } from "@/lib/crypto";
import { applyPlan, buildPlan, countExport, exportToDrive, runBackup, type PlanItem } from "@/lib/data-io";
import { exportSheetAsXlsx } from "@/lib/drive";
import { readWorkbook } from "@/lib/sheets";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional();
const exportSchema = z.object({ from: day, to: day, clientes: z.boolean(), trabajos: z.boolean(), pagos: z.boolean() });

/** RF-27: exportar como Google Sheets en el Drive del admin. */
export async function exportToSheets(input: z.input<typeof exportSchema>): Promise<ActionResult<{ link: string | null; name: string }>> {
  try {
    const user = await assertRole("admin");
    const v = exportSchema.parse(input);
    if (!v.clientes && !v.trabajos && !v.pagos) throw new UserError("Elige al menos una tabla.");
    const file = await exportToDrive({ from: v.from || null, to: v.to || null }, v);
    await audit({ entity: "configuracion", entityId: "exportacion", action: "exportar", summary: `exportó a Drive «${file.name}»`, after: v, userId: user.id });
    return { ok: true, data: { link: file.webViewLink ?? null, name: file.name } };
  } catch (e) {
    return fail(e);
  }
}

/** Respaldo a pedido, además del diario (RF-32). */
export async function backupNow(): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    await runBackup();
    await audit({ entity: "configuracion", entityId: "respaldo", action: "respaldo", summary: "hizo un respaldo a mano", userId: user.id });
    revalidatePath("/", "layout");
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
    // RF-28 y RF-34: elegido con el Picker, que da el permiso de lectura.
    fileId = driveFileId;
    data = await exportSheetAsXlsx(driveFileId);
    fileName = String(formData.get("fileName") || "Planilla de Google");
  } else if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) throw new UserError("El archivo pesa más de 4 MB.");
    if (!/\.xlsx$/i.test(file.name)) throw new UserError("Sube un archivo .xlsx (Excel o Google Sheets descargado).");
    data = Buffer.from(await file.arrayBuffer());
    fileName = file.name;
  } else {
    throw new UserError("Elige un archivo.");
  }
  let sheets;
  try {
    sheets = await readWorkbook(data);
  } catch {
    throw new UserError("No se pudo leer el archivo. ¿Es un .xlsx?");
  }
  return { mode, fileName, fileId, sheets, hash: sha256(data) };
}

export type ImportPreview = { items: PlanItem[]; errors: number; valid: number; fileName: string; alreadyImported: boolean };

async function alreadyImported(hash: string, fileId: string | null) {
  return !!(await db.query.imports.findFirst({ where: fileId ? or(eq(imports.contentHash, hash), eq(imports.driveFileId, fileId)) : eq(imports.contentHash, hash) }));
}

/** RF-28: vista previa con los errores antes de guardar. */
export async function previewImport(formData: FormData): Promise<ActionResult<ImportPreview>> {
  try {
    await assertRole("admin");
    const src = await readSource(formData);
    const plan = await buildPlan(src.sheets, src.mode);
    return { ok: true, data: { items: plan.items, errors: plan.errors, valid: plan.ops.length, fileName: src.fileName, alreadyImported: await alreadyImported(src.hash, src.fileId) } };
  } catch (e) {
    return fail(e);
  }
}

/** RF-28 y RF-34: importa las filas válidas. Un archivo ya importado se rechaza. */
export async function applyImport(formData: FormData): Promise<ActionResult<{ clientes: number; trabajos: number; pagos: number; estados: number }>> {
  try {
    const user = await assertRole("admin");
    const src = await readSource(formData);
    if (await alreadyImported(src.hash, src.fileId)) throw new UserError("Este archivo ya fue importado.");
    const plan = await buildPlan(src.sheets, src.mode);
    if (!plan.ops.length) throw new UserError("No hay filas válidas para importar.");
    const importId = crypto.randomUUID();
    await db.insert(imports).values({ id: importId, kind: src.mode, driveFileId: src.fileId, fileName: src.fileName, contentHash: src.hash, importedById: user.id });
    const result = await applyPlan(plan, { userId: user.id, mode: src.mode, fileName: src.fileName, hash: src.hash });
    await batch([db.update(imports).set({ summary: { ...result, omitidas: plan.errors } }).where(eq(imports.id, importId))]);
    revalidatePath("/", "layout");
    return { ok: true, data: { clientes: result.clientes, trabajos: result.trabajos, pagos: result.pagos, estados: result.estados } };
  } catch (e) {
    return fail(e);
  }
}

/** Cuántas filas saldrían en la exportación con ese rango (las cifras junto a cada casilla). */
export async function countForExport(input: { from?: string; to?: string }): Promise<ActionResult<{ clientes: number; trabajos: number; pagos: number }>> {
  try {
    await assertRole("admin");
    const v = z.object({ from: day, to: day }).parse(input);
    return { ok: true, data: await countExport({ from: v.from || null, to: v.to || null }) };
  } catch (e) {
    return fail(e);
  }
}
