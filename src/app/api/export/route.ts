import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-guard";
import { audit } from "@/lib/audit";
import { loadExportData, loadHistoryRows } from "@/lib/data-io";
import { addDays, todayLima } from "@/lib/dates";
import { buildDataWorkbook } from "@/lib/sheets";
import { XLSX_MIME } from "@/lib/drive";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** RF-27: descarga en .xlsx (solo admin). ?tablas=clientes,trabajos,pagos o historial, &desde, &hasta */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new NextResponse("No autorizado", { status: 403 });
  const sp = request.nextUrl.searchParams;
  const from = sp.get("desde");
  const to = sp.get("hasta");
  const range = { from: from && DAY.test(from) ? from : null, to: to && DAY.test(to) ? to : null };
  const tables = (sp.get("tablas") ?? "clientes,trabajos,pagos").split(",");
  let data: Buffer;
  let name: string;
  if (tables.includes("historial")) {
    data = await buildDataWorkbook({ history: await loadHistoryRows(range.from ?? addDays(todayLima(), -30)) });
    name = `historial-${todayLima()}.xlsx`;
  } else {
    const t = { clientes: tables.includes("clientes"), trabajos: tables.includes("trabajos"), pagos: tables.includes("pagos") };
    data = await buildDataWorkbook(await loadExportData(range, t));
    name = `pedidos-${todayLima()}.xlsx`;
  }
  await audit({ entity: "configuracion", entityId: "exportacion", action: "descargar", summary: `descargó ${name}`, after: { ...range, tables }, userId: user.id });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": XLSX_MIME, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
