import "server-only";
import ExcelJS from "exceljs";

/**
 * Columnas de la plantilla de importación (RF-28). El respaldo diario (RF-32)
 * usa exactamente las mismas, para que un respaldo se pueda volver a cargar.
 */
export const CLIENT_COLUMNS = [
  "Nombre",
  "WhatsApp",
  "Universidad",
  "Carrera",
  "Ciclo",
  "Cómo llegó",
  "Software",
  "Versión",
  "Formato habitual",
  "Observaciones",
] as const;

export const JOB_COLUMNS = [
  "Código",
  "WhatsApp del cliente",
  "Ítems",
  "Ciclo",
  "Curso",
  "Profesor",
  "Sección",
  "Ciclo académico",
  "Descripción",
  "Fecha de entrega",
  "Urgencia",
  "Precio",
  "Responsable",
  "Estado",
  "Relacionado con",
  "Correcciones",
] as const;

export const PAYMENT_COLUMNS = [
  "Código del trabajo",
  "Tipo",
  "Monto",
  "Fecha",
  "Medio",
  "Número de operación",
  "Motivo",
  "Registrado por",
] as const;

/** Hojas de la planilla de contingencia (sección 7.3). */
export const CONTINGENCY = {
  codes: "Últimos códigos",
  clients: "Clientes nuevos",
  jobs: "Trabajos nuevos",
  statuses: "Cambios de estado",
  payments: "Pagos",
} as const;

export const CONTINGENCY_CLIENT_COLUMNS = ["Nombre", "WhatsApp", "Universidad", "Carrera", "Ciclo", "Cómo llegó"] as const;
export const CONTINGENCY_JOB_COLUMNS = [
  "Código",
  "WhatsApp del cliente",
  "Ítems",
  "Ciclo",
  "Curso",
  "Profesor",
  "Sección",
  "Descripción",
  "Fecha de entrega",
  "Urgencia",
  "Precio",
  "Responsable",
  "Relacionado con",
] as const;
export const CONTINGENCY_STATUS_COLUMNS = ["Código", "Nuevo estado", "Fecha y hora", "Quién"] as const;
export const CONTINGENCY_PAYMENT_COLUMNS = ["Código del trabajo", "Monto", "Fecha", "Medio", "Número de operación", "Quién lo registró"] as const;

export type SheetRow = Record<string, string>;

function addSheet(wb: ExcelJS.Workbook, name: string, columns: readonly string[], rows: (string | number | null)[][] = []) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((header) => ({ header, width: Math.max(14, header.length + 4) }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r.map((v) => (v === null ? "" : v)));
  return ws;
}

export type ExportData = {
  clients: (string | number | null)[][];
  jobs: (string | number | null)[][];
  payments: (string | number | null)[][];
};

/** RF-27 y RF-32: una hoja por tabla (solo las pedidas). */
export async function buildDataWorkbook(data: Partial<ExportData> & { history?: (string | number | null)[][] }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestión de pedidos";
  if (data.clients) addSheet(wb, "Clientes", CLIENT_COLUMNS, data.clients);
  if (data.jobs) addSheet(wb, "Trabajos", JOB_COLUMNS, data.jobs);
  if (data.payments) addSheet(wb, "Pagos", PAYMENT_COLUMNS, data.payments);
  if (data.history) addSheet(wb, "Historial", ["Fecha y hora", "Quién", "Trabajo", "Qué", "Acción", "Detalle"], data.history);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Plantilla vacía para la carga inicial (RF-28). */
export async function buildTemplateWorkbook(): Promise<Buffer> {
  return buildDataWorkbook({
    clients: [["Lucía Huamán", "987 654 321", "UPC", "Arquitectura", "7", "Instagram", "AutoCAD", "2024", "A3", "Paga por Yape"]],
    jobs: [["", "987 654 321", "PL-02 x2, PL-06", 7, "Taller 5", "Arq. Ramos", "B", "", "Planos de vivienda", "2026-12-05 18:00", "Normal", "", "", "Confirmado", "", 0]],
    payments: [],
  });
}

/** RF-33: planilla de contingencia vacía, con los últimos códigos en la primera hoja. */
export async function buildContingencyWorkbook(info: {
  year: number;
  lastSeq: number;
  types: { name: string; prefix: string; lastCode: string | null; nextCode: string }[];
  updatedAt: string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(CONTINGENCY.codes);
  ws.columns = [{ width: 28 }, { width: 12 }, { width: 22 }, { width: 22 }];
  ws.addRow(["Planilla de contingencia"]).font = { bold: true, size: 14 };
  ws.addRow([`Actualizada: ${info.updatedAt}. Úsala solo si el sistema está caído: haz una copia (Archivo → Hacer una copia) con la fecha en el nombre.`]);
  ws.addRow([`Último número usado en ${info.year}: ${info.lastSeq}. El número es compartido por todos los tipos: sigue desde el siguiente.`]);
  ws.addRow([]);
  ws.addRow(["Tipo de servicio", "Prefijo", "Último código usado", "Siguiente código"]).font = { bold: true };
  for (const t of info.types) ws.addRow([t.name, t.prefix, t.lastCode ?? "—", t.nextCode]);
  ws.addRow([]);
  ws.addRow(["Anota una fila por cada hecho. No borres ni edites filas: si algo está mal, agrega otra fila que lo corrija."]);
  ws.addRow(["Fechas como AAAA-MM-DD (por ejemplo 2026-11-21). Medios: Yape, Plin, Transferencia o Efectivo."]);

  addSheet(wb, CONTINGENCY.clients, CONTINGENCY_CLIENT_COLUMNS);
  addSheet(wb, CONTINGENCY.jobs, CONTINGENCY_JOB_COLUMNS);
  addSheet(wb, CONTINGENCY.statuses, CONTINGENCY_STATUS_COLUMNS);
  addSheet(wb, CONTINGENCY.payments, CONTINGENCY_PAYMENT_COLUMNS);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // Las fechas llegan como medianoche UTC; si traen hora, se conserva.
    const iso = value.toISOString();
    return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
  }
  if (typeof value === "object") {
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((t) => t.text).join("");
    if ("text" in value) return String(value.text);
    if ("error" in value) return "";
  }
  return String(value).trim();
}

/** Lee cada hoja como filas { encabezado: texto }. Ignora filas vacías. */
export async function readWorkbook(data: Buffer, headerRow: Record<string, number> = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as unknown as ArrayBuffer);
  const sheets: Record<string, { rows: { line: number; values: SheetRow }[] }> = {};
  wb.eachSheet((ws) => {
    const hr = headerRow[ws.name] ?? 1;
    const headers: string[] = [];
    ws.getRow(hr).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col] = cellText(cell.value);
    });
    const rows: { line: number; values: SheetRow }[] = [];
    ws.eachRow((row, line) => {
      if (line <= hr) return;
      const values: SheetRow = {};
      let any = false;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const h = headers[col];
        if (!h) return;
        const t = cellText(cell.value);
        if (t) any = true;
        values[h] = t;
      });
      if (any) rows.push({ line, values });
    });
    sheets[ws.name] = { rows };
  });
  return sheets;
}
