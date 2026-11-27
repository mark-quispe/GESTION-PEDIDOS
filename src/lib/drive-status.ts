import type { settings } from "@/db/schema";

/** Drive conectado y con carpeta raíz elegida (RF-22). */
export function isDriveReady(s: typeof settings.$inferSelect) {
  return !!s.driveRefreshTokenEnc && !s.driveDisconnectedAt && !!s.driveRootFolderId;
}
