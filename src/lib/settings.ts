import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { settings } from "@/db/schema";
import { DEFAULT_CYCLE_FACTORS, DEFAULT_URGENCY } from "@/db/tarifario";
import { dayKey, timeLima, todayLima, dayMonth } from "@/lib/dates";
import type { SystemStatus } from "@/components/layout/app-nav";

export const getSettings = cache(async () => {
  await dbReady();
  const s = await db.query.settings.findFirst({ where: eq(settings.id, 1) });
  if (s) return s;
  // Base nueva en Neon: se crea la fila de configuración con los valores del tarifario.
  const [row] = await db
    .insert(settings)
    .values({
      id: 1,
      urgency: DEFAULT_URGENCY,
      cycleFactors: DEFAULT_CYCLE_FACTORS,
      alerts: { quoteDays: 2, pendingDays: 3, driveFullPct: 90, backupFailed: true },
    })
    .onConflictDoNothing()
    .returning();
  return row ?? (await db.query.settings.findFirst({ where: eq(settings.id, 1) }))!;
});

/** Ventanita Sistema del menú admin (RF-20, RF-56). */
export async function getSystemStatus(): Promise<SystemStatus> {
  const s = await getSettings();
  const driveOk = !!s.driveRefreshTokenEnc && !s.driveDisconnectedAt && !!s.driveRootFolderId;
  const drive = !s.driveRefreshTokenEnc ? "Sin conectar" : s.driveDisconnectedAt ? "Desconectado" : "Conectado";
  let backup = "Aún no";
  let backupOk = false;
  if (s.lastBackupAt) {
    const same = dayKey(s.lastBackupAt) === todayLima();
    backup = s.lastBackupOk === false ? "Falló" : `${same ? "Hoy" : dayMonth(s.lastBackupAt)} ${timeLima(s.lastBackupAt)}`;
    backupOk = s.lastBackupOk !== false || s.alerts.backupFailed === false;
  }
  const ok = driveOk && backupOk;
  return {
    ok,
    label: ok ? "En orden" : !driveOk ? "Revisar Drive" : "Revisar respaldo",
    drive,
    driveOk,
    backup,
    backupOk,
    contingency: s.driveContingencyFileId
      ? { label: "Abrir", href: `https://docs.google.com/spreadsheets/d/${s.driveContingencyFileId}` }
      : { label: "Aún no", href: null },
  };
}
