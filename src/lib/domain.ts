/**
 * Reglas del negocio que se usan igual en pantalla y en el servidor.
 * Todo sale de docs/requerimientos.md (v0.9).
 */
import type { JobStatus, PaymentMethod, Role, Urgency } from "@/db/schema";

/* ---------- Roles (2.1) ---------- */

export const ROLE_LABEL: Record<Role, string> = { admin: "Administrador", empleado: "Empleado", produccion: "Producción" };

export const isAdmin = (roles: readonly string[]) => roles.includes("admin");
/** Producción = Empleado + Tomar. El admin ya incluye todo. */
export const canTake = (roles: readonly string[]) => roles.includes("admin") || roles.includes("produccion");

export function rolesLabel(roles: readonly string[]) {
  if (roles.includes("admin")) return ROLE_LABEL.admin;
  return roles
    .filter((r): r is Role => r in ROLE_LABEL)
    .map((r) => ROLE_LABEL[r])
    .join(" + ");
}

/* ---------- Estados (RF-09) ---------- */

export const STATUS_LABEL: Record<JobStatus, string> = {
  cotizacion: "Cotización",
  confirmado: "Confirmado",
  en_proceso: "En proceso",
  terminado: "Terminado",
  en_revision: "En revisión por el cliente",
  correcciones: "Correcciones",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

/** Etiqueta corta para listas. */
export const STATUS_SHORT: Record<JobStatus, string> = {
  ...STATUS_LABEL,
  terminado: "Terminado · por enviar",
  en_revision: "En revisión",
};

/** Pasos de la barra de estados de la ficha (RF-61). */
export const STATUS_STEPS: JobStatus[] = ["cotizacion", "confirmado", "en_proceso", "terminado", "en_revision", "finalizado"];

export const CLOSED_STATUSES: JobStatus[] = ["finalizado", "cancelado"];
export const isClosed = (s: JobStatus) => CLOSED_STATUSES.includes(s);
export const isOpen = (s: JobStatus) => !isClosed(s);

/** RF-13: solo cuenta como atrasado mientras depende del estudio. */
export const LATE_STATUSES: JobStatus[] = ["confirmado", "en_proceso", "correcciones"];

export function isLate(status: JobStatus, dueAt: Date | string, now = new Date()) {
  return LATE_STATUSES.includes(status) && new Date(dueAt).getTime() < now.getTime();
}

/** Días de atraso (redondeado hacia arriba), 0 si no está atrasado. */
export function lateDays(status: JobStatus, dueAt: Date | string, now = new Date()) {
  if (!isLate(status, dueAt, now)) return 0;
  return Math.max(1, Math.ceil((now.getTime() - new Date(dueAt).getTime()) / 86_400_000));
}

/**
 * Color de estado para punto y texto. El color solo comunica estados:
 * rojo atrasado, ámbar por tomar / cotización, azul en curso, blanco terminado, verde finalizado.
 */
export type Tone = "danger" | "warning" | "info" | "success" | "neutral" | "strong" | "muted";

export function statusTone(status: JobStatus, late = false, unassigned = false): Tone {
  if (late) return "danger";
  switch (status) {
    case "cotizacion":
      return "warning";
    case "confirmado":
      return unassigned ? "warning" : "info";
    case "en_proceso":
      return unassigned ? "warning" : "info";
    case "correcciones":
      return "warning";
    case "terminado":
      return "strong";
    case "en_revision":
      return "info";
    case "finalizado":
      return "success";
    case "cancelado":
      return "muted";
  }
}

/* ---------- Urgencia (RF-57) ---------- */

export const URGENCY_LABEL: Record<Urgency, string> = { normal: "Normal", alta: "Alta", urgente: "Urgente" };
export const URGENCIES: Urgency[] = ["normal", "alta", "urgente"];

export function formatDeadline(hours: number) {
  if (hours >= 48 && hours % 24 === 0) return `${hours / 24} días`;
  return `${hours} h`;
}

/* ---------- Pagos (RF-14, RF-17) ---------- */

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
};
export const METHODS: PaymentMethod[] = ["yape", "plin", "transferencia", "efectivo"];

export type MoneyMovement = { kind: "pago" | "devolucion"; amount: number; voidedAt?: Date | string | null; deletedAt?: Date | string | null };

/** Lo pagado neto: pagos menos devoluciones, sin anulados ni eliminados. */
export function paidNet(movements: MoneyMovement[]) {
  return round2(
    movements
      .filter((m) => !m.voidedAt && !m.deletedAt)
      .reduce((s, m) => s + (m.kind === "devolucion" ? -m.amount : m.amount), 0),
  );
}

export type PayState = "sin_pagar" | "adelanto" | "pagado" | "de_mas";

export const PAY_STATE_LABEL: Record<PayState, string> = {
  sin_pagar: "Sin pagar",
  adelanto: "Adelanto pagado",
  pagado: "Pagado completo",
  de_mas: "Pagado de más",
};

export function payState(total: number, paid: number): PayState {
  if (paid > total + 0.004) return "de_mas";
  if (paid <= 0.004) return "sin_pagar";
  if (paid + 0.004 >= total) return "pagado";
  return "adelanto";
}

/* ---------- Precio (RF-59) ---------- */

export const round2 = (n: number) => Math.round(n * 100) / 100;

export type PriceLine = { basePrice: number; quantity: number; pricingMode: "fijo" | "ciclo"; hours?: number | null };

export function cycleFactor(factors: Record<string, number>, cycle: number | null | undefined) {
  if (!cycle) return 1;
  return factors[String(cycle)] ?? 1;
}

export function lineAmount(line: PriceLine, factor: number) {
  return round2(line.basePrice * line.quantity * (line.pricingMode === "ciclo" ? factor : 1));
}

/** Total = Σ(base × cantidad × factor si es ×C) × (1 + recargo) + adicional − descuento. */
export function computeTotal(lines: PriceLine[], factor: number, urgencyPct: number, extra = 0, discount = 0) {
  const subtotal = round2(lines.reduce((s, l) => s + lineAmount(l, factor), 0));
  const surcharge = round2(subtotal * (urgencyPct / 100));
  const total = round2(subtotal + surcharge + (extra || 0) - (discount || 0));
  const hours = round2(lines.reduce((s, l) => s + (l.hours ?? 0) * l.quantity, 0));
  return { subtotal, surcharge, total: Math.max(0, total), hours };
}

/* ---------- Código (RF-08) ---------- */

export function jobCode(prefix: string, year: number, seq: number) {
  return `${prefix}${String(year).slice(-2)}-${String(seq).padStart(3, "0")}`;
}

/** Ciclo académico tipo 2026-II deducido de la fecha (I: ene–jul, II: ago–dic). */
export function academicTermFor(d: Date) {
  const y = d.getFullYear();
  return `${y}-${d.getMonth() >= 7 ? "II" : "I"}`;
}

/* ---------- Texto ---------- */

export function initials(name: string | null | undefined) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

/** Sin tildes ni mayúsculas, para buscar. */
export function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** WhatsApp: solo dígitos, sin el 51 de Perú. */
export function normalizePhone(s: string) {
  const d = s.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("51") ? d.slice(2) : d;
}

export function formatPhone(s: string | null | undefined) {
  if (!s) return "—";
  const d = s.replace(/\D/g, "");
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : s;
}
