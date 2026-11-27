"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, batch } from "@/db";
import { settings } from "@/db/schema";
import type { ActionResult } from "@/actions/result";
import { assertRole } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { fail, UserError } from "@/lib/action-utils";
import { FOLDER_MIME, forgetAccessToken, getAccessToken, getFile } from "@/lib/drive";
import { getSettings } from "@/lib/settings";

export type PickerConfig = { accessToken: string; apiKey: string; appId: string };

/** Token de corta duración para abrir el Google Picker. Solo el admin. */
export async function getPickerConfig(): Promise<ActionResult<PickerConfig>> {
  try {
    await assertRole("admin");
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
    if (!apiKey || !appId) throw new UserError("Falta configurar el selector de Google (NEXT_PUBLIC_GOOGLE_API_KEY y NEXT_PUBLIC_GOOGLE_APP_ID).");
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
    if (!folder || folder.mimeType !== FOLDER_MIME || folder.trashed) throw new UserError("Elige una carpeta de Drive.");
    const before = await getSettings();
    const changed = before.driveRootFolderId !== folder.id;
    await batch([
      db
        .update(settings)
        .set({ driveRootFolderId: folder.id, driveRootFolderName: folder.name, ...(changed ? { driveBackupsFolderId: null, driveContingencyFileId: null } : {}) })
        .where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "drive", action: "carpeta", summary: `eligió la carpeta raíz «${folder.name}»`, before: before.driveRootFolderName, after: folder.name, userId: user.id }),
    ]);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Quita la llave de Drive. Los archivos se quedan donde están. */
export async function disconnectDrive(): Promise<ActionResult> {
  try {
    const user = await assertRole("admin");
    await batch([
      db.update(settings).set({ driveRefreshTokenEnc: null, driveDisconnectedAt: null, driveConnectedAt: null }).where(eq(settings.id, 1)),
      audit({ entity: "configuracion", entityId: "drive", action: "desconectar", summary: "desconectó Drive", userId: user.id }),
    ]);
    forgetAccessToken();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
