import type { JobStatus, Urgency } from "@/db/schema";
import { PAYMENT_STATUS_LABELS, STATUS_LABELS, URGENCY_LABELS, type PaymentStatus } from "@/lib/domain";
import { Badge } from "@/components/ui/badge";

type Variant = "outline" | "warning" | "info" | "success" | "danger" | "muted";

/** Color por significado: espera (ámbar), en curso (azul), hecho (verde), anulado (gris). */
export const STATUS_VARIANT: Record<JobStatus, Variant> = {
  consulta: "outline",
  cotizado: "warning",
  confirmado: "info",
  en_proceso: "info",
  en_revision: "info",
  correcciones: "warning",
  entregado: "success",
  cancelado: "muted",
};

export const STATUS_DOT: Record<JobStatus, string> = {
  consulta: "bg-muted-foreground",
  cotizado: "bg-warning",
  confirmado: "bg-info",
  en_proceso: "bg-info",
  en_revision: "bg-info",
  correcciones: "bg-warning",
  entregado: "bg-success",
  cancelado: "bg-border",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function LateBadge() {
  return <Badge variant="danger">Atrasado</Badge>;
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const v: Record<PaymentStatus, Variant> = { sin_pagar: "outline", adelanto: "warning", completo: "success" };
  return <Badge variant={v[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  if (urgency === "normal") return null;
  return <Badge variant={urgency === "urgente" ? "danger" : "warning"}>{URGENCY_LABELS[urgency]}</Badge>;
}
