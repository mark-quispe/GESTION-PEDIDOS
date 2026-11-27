"use server";

import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/action-utils";
import { FOLDER_MIME, forgetAccessToken, getAccessToken, getFile, getSettings } from "@/lib/drive";
import type { ActionResult } from "./result";

export type PickerConfig = { accessToken: string; apiKey: string; appId: string };

/** Token de corta duración para abrir el Google Picker. Solo el admin. */
export async function getPickerConfig(): Promise<ActionResult<PickerConfig>> {
  try {
    await assertRole("admin");
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
    if (!apiKey || !appId) return { ok: false, error: "Faltan NEXT_PUBLIC_GOOGLE_API_KEY y NEXT_PUBLIC_GOOGLE_APP_ID en la configuración." };
    return { ok: true, data: { accessToken: await getAccessToken(), apiKey, appId } };
  } catch (e) {
    return fail(e);
  }
}

/** RF-22 y RF-26: guarda la carpeta raíz elegida con el Picker. */
export async function setDriveRoot(folderId: string): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    const id = z.string().min(5).max(200).parse(folderId);
    const folder = await getFile(id);
    if (!folder || folder.mimeType !== FOLDER_MIME || folder.trashed) return { ok: false, error: "Elige una carpeta de Drive." };
    const before = await getSettings();
    const changed = before.driveRootFolderId !== folder.id;
    await db.batch([
      db
        .update(settings)
        .set({
          driveRootFolderId: folder.id,
          driveRootFolderName: folder.name,
          // En la carpeta nueva se crean "Respaldos" y la planilla de contingencia de nuevo.
          ...(changed ? { driveBackupsFolderId: null, driveContingencyFileId: null } : {}),
        })
        .where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "drive", action: "carpeta", before: before.driveRootFolderName, after: folder.name, userId: user.id }),
    ]);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectDrive(): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    await db.batch([
      db.update(settings).set({ driveRefreshTokenEnc: null, driveDisconnectedAt: null, driveConnectedAt: null }).where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "drive", action: "desconectar", userId: user.id }),
    ]);
    forgetAccessToken();
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
