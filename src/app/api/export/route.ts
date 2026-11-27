import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { loadExportData } from "@/lib/data-io";
import { todayLima } from "@/lib/dates";
import { buildDataWorkbook } from "@/lib/sheets";
import { XLSX_MIME } from "@/lib/drive";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** RF-27: descarga en .xlsx (solo admin). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new NextResponse("No autorizado", { status: 403 });
  const from = request.nextUrl.searchParams.get("desde");
  const to = request.nextUrl.searchParams.get("hasta");
  const range = { from: from && DAY.test(from) ? from : null, to: to && DAY.test(to) ? to : null };
  const data = await buildDataWorkbook(await loadExportData(range));
  await audit({ entity: "configuracion", entityId: "exportacion", action: "descargar_xlsx", after: range, userId: user.id });
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="pedidos-${todayLima()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
