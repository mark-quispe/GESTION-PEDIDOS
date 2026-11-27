import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { buildTemplateWorkbook } from "@/lib/sheets";
import { XLSX_MIME } from "@/lib/drive";

/** RF-28: plantilla de importación (las mismas columnas que el respaldo). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new NextResponse("No autorizado", { status: 403 });
  return new NextResponse(new Uint8Array(await buildTemplateWorkbook()), {
    headers: { "Content-Type": XLSX_MIME, "Content-Disposition": 'attachment; filename="plantilla-importacion.xlsx"' },
  });
}
