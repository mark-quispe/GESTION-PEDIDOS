/**
 * Vocabulario del negocio y cálculos derivados (sin base de datos).
 * Se usa en servidor y en cliente.
 */
import type { JobFolder, JobStatus, PaymentKind, PaymentMethod, Urgency } from "@/db/schema";

export const JOB_STATUSES: JobStatus[] = [
  "consulta",
  "cotizado",
  "confirmado",
  "en_proceso",
  "en_revision",
  "correcciones",
  "entregado",
  "cancelado",
];

/** RF-09 */
export const STATUS_LABELS: Record<JobStatus, string> = {
  consulta: "Consulta",
  cotizado: "Cotizado",
  confirmado: "Confirmado",
  en_proceso: "En proceso",
  en_revision: "En revisión",
  correcciones: "Correcciones",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const STATUS_HINTS: Record<JobStatus, string> = {
  consulta: "Escribió, todavía no hay precio",
  cotizado: "Se le dio el precio y falta que confirme",
  confirmado: "Pagó el adelanto y el trabajo empieza",
  en_proceso: "Alguien lo está haciendo",
  en_revision: "Se le envió el avance o el trabajo final",
  correcciones: "Pidió cambios",
  entregado: "Recibió la versión final",
  cancelado: "No confirmó o se echó atrás",
};

/** Estados cerrados: no cuentan como abiertos ni como atrasados. */
export const CLOSED_STATUSES: JobStatus[] = ["entregado", "cancelado"];
export const OPEN_STATUSES = JOB_STATUSES.filter((s) => !CLOSED_STATUSES.includes(s));
/** RF-41: trabajos en curso (ya confirmados y sin entregar). */
export const ACTIVE_STATUSES: JobStatus[] = ["confirmado", "en_proceso", "en_revision", "correcciones"];

export const URGENCIES: Urgency[] = ["normal", "alta", "urgente"];
export const URGENCY_LABELS: Record<Urgency, string> = { normal: "Normal", alta: "Alta", urgente: "Urgente" };

export const PAYMENT_METHODS: PaymentMethod[] = ["yape", "plin", "transferencia", "efectivo"];
export const METHOD_LABELS: Record<PaymentMethod, string> = {
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
};

export const KIND_LABELS: Record<PaymentKind, string> = { pago: "Pago", devolucion: "Devolución" };

export const FOLDER_LABELS: Record<JobFolder, string> = {
  recibido: "Recibido",
  avances: "Avances",
  entrega_final: "Entrega final",
  pagos: "Pagos",
};
export const UPLOAD_FOLDERS: JobFolder[] = ["recibido", "avances", "entrega_final"];

/** RF-08: PL26-014. El número lleva al menos tres cifras. */
export function formatJobCode(prefix: string, year: number, seq: number) {
  return `${prefix.toUpperCase()}${String(year % 100).padStart(2, "0")}-${String(seq).padStart(3, "0")}`;
}

/** RF-13: atrasado si la fecha ya pasó y no se entregó. */
export function isLate(status: JobStatus, dueDate: string | null, today: string) {
  return !!dueDate && dueDate < today && !CLOSED_STATUSES.includes(status);
}

/** RF-17: estado de pago, separado del estado del trabajo. */
export type PaymentStatus = "sin_pagar" | "adelanto" | "completo";
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  sin_pagar: "Sin pagar",
  adelanto: "Adelanto pagado",
  completo: "Pagado completo",
};

export function paymentStatus(price: string | number | null, paid: string | number): PaymentStatus {
  const p = Number(paid);
  if (p <= 0) return "sin_pagar";
  if (price === null || Number(price) <= 0 || p < Number(price)) return "adelanto";
  return "completo";
}

/** RF-16: saldo pendiente. Nunca negativo en pantalla; un saldo a favor se muestra aparte. */
export function balance(price: string | number | null, paid: string | number) {
  if (price === null) return 0;
  return Math.round((Number(price) - Number(paid)) * 100) / 100;
}

/** RF-36: el WhatsApp se guarda solo con dígitos y código de país de Perú si falta. */
export function normalizeWhatsapp(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("9")) return `51${digits}`;
  return digits;
}

export function formatWhatsapp(digits: string) {
  if (digits.length === 11 && digits.startsWith("51")) {
    return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return digits ? `+${digits}` : "";
}

/** Para comparar textos escritos a mano (RF-35): sin mayúsculas, tildes ni espacios de más. */
export function normalizeText(s: string | null | undefined) {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const ROLE_LABELS = { admin: "Administrador", empleado: "Empleado" } as const;
