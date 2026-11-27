import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { runBackup } from "@/lib/data-io";
import { driveState } from "@/lib/drive";
import { getSettings } from "@/lib/settings";

export const maxDuration = 60;

/** RF-32: lo llama el cron de Vercel una vez al día (vercel.json: 08:00 UTC = 03:00 en Lima). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("No autorizado", { status: 401 });
  const s = await getSettings();
  if (!s.backupEnabled) return NextResponse.json({ ok: false, reason: "Respaldo pausado" });
  if (driveState(s) !== "conectado") return NextResponse.json({ ok: false, reason: `Drive ${driveState(s)}` });
  try {
    return NextResponse.json({ ok: true, ...(await runBackup()) });
  } catch (e) {
    console.error("Respaldo diario falló", e);
    await db.update(settings).set({ lastBackupOk: false }).where(eq(settings.id, 1));
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
