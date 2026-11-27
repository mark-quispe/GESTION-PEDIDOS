import type { JobStatus } from "@/db/schema";
import { STATUS_LABELS } from "./domain";
import { formatMoney } from "./utils";

const ENTITY: Record<string, string> = {
  cliente: "Cliente",
  trabajo: "Trabajo",
  pago: "Pago",
  nota: "Nota",
  archivo: "Archivo",
  usuario: "Usuario",
  responsable: "Responsable",
  servicio: "Servicio",
  configuracion: "Configuración",
  importacion: "Importación",
};

const ACTION: Record<string, string> = {
  crear: "creó",
  editar: "editó",
  estado: "cambió el estado",
  precio: "cambió el precio",
  eliminar: "eliminó",
  restaurar: "restauró",
  corregir: "corrigió",
  devolucion: "registró una devolución",
  subir: "subió",
  observaciones: "editó las observaciones",
  dar_acceso: "dio acceso",
  quitar_acceso: "quitó el acceso",
  rol: "cambió el rol",
  activar: "activó",
  desactivar: "desactivó",
  conectar: "conectó Drive",
  desconectar: "desconectó Drive",
  carpeta: "cambió la carpeta de Drive",
  carpeta_creada: "creó la carpeta en Drive",
  carpeta_recreada: "volvió a crear la carpeta en Drive",
  exportar: "exportó a Google Sheets",
  descargar_xlsx: "descargó un .xlsx",
  respaldo_manual: "hizo un respaldo",
  planilla: "importó una planilla",
  contingencia: "importó la planilla de contingencia",
};

const FIELD: Record<string, string> = {
  serviceTypeId: "tipo",
  course: "curso",
  professor: "profesor",
  section: "sección",
  academicTerm: "ciclo",
  description: "descripción",
  dueDate: "entrega",
  urgency: "urgencia",
  price: "precio",
  responsableId: "responsable",
  amount: "monto",
  paidOn: "fecha",
  method: "medio",
  operationNumber: "operación",
};

export const entityLabel = (e: string) => ENTITY[e] ?? e;
export const actionLabel = (a: string) => ACTION[a] ?? a;

const status = (v: unknown) => {
  const s = typeof v === "object" && v && "estado" in v ? (v as { estado: string }).estado : v;
  return STATUS_LABELS[s as JobStatus] ?? String(s);
};

/** Resumen legible de antes → después. */
export function auditDetail(action: string, before: unknown, after: unknown): string {
  if (action === "estado") return `${status(before)} → ${status(after)}`;
  if (action === "precio" || action === "editar" || action === "corregir") {
    const b = (before ?? {}) as Record<string, unknown>;
    const a = (after ?? {}) as Record<string, unknown>;
    return Object.keys(a)
      .filter((k) => k !== "motivo" && String(b[k] ?? "") !== String(a[k] ?? ""))
      .map((k) => {
        const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "vacío" : k === "price" || k === "amount" ? formatMoney(String(v)) : String(v));
        return `${FIELD[k] ?? k}: ${fmt(b[k])} → ${fmt(a[k])}`;
      })
      .slice(0, 6)
      .join(" · ");
  }
  if (action === "crear" && after && typeof after === "object") {
    const a = after as Record<string, unknown>;
    return [a.code, a.name, a.amount && formatMoney(String(a.amount)), a.quien && `anotado por ${a.quien}`].filter(Boolean).join(" · ");
  }
  if (typeof after === "string" || typeof after === "number") return before ? `${before} → ${after}` : String(after);
  if (after && typeof after === "object" && "name" in after) return String((after as { name: string }).name);
  return "";
}
