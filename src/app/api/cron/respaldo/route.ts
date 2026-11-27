import { NextResponse, type NextRequest } from "next/server";
import { runBackup } from "@/lib/data-io";
import { driveState, getSettings } from "@/lib/drive";

export const maxDuration = 60;

/** RF-32: lo llama el cron de Vercel una vez al día (vercel.json). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  const s = await getSettings();
  if (driveState(s) !== "conectado") return NextResponse.json({ ok: false, reason: `Drive ${driveState(s)}` });
  try {
    const result = await runBackup();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("Respaldo diario falló", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
