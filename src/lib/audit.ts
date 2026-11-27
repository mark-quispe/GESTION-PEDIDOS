import "server-only";
import { db } from "@/db";
import { auditLog, type RecordSource } from "@/db/schema";

export type AuditEntity =
  | "cliente"
  | "trabajo"
  | "item"
  | "pago"
  | "nota"
  | "archivo"
  | "usuario"
  | "externo"
  | "servicio"
  | "configuracion"
  | "importacion"
  | "sesion";

export type AuditEntry = {
  entity: AuditEntity;
  entityId: string;
  action: string;
  /** Frase corta para el Historial: «tomó el trabajo», «anuló el pago de S/ 120.00». */
  summary?: string;
  jobId?: string | null;
  before?: unknown;
  after?: unknown;
  userId: string | null;
  source?: RecordSource;
};

/** RF-21: devuelve la inserción para meterla en el mismo `batch` que el cambio. */
export function audit(entry: AuditEntry) {
  return db.insert(auditLog).values({
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    summary: entry.summary ?? null,
    jobId: entry.jobId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    userId: entry.userId,
    source: entry.source ?? "sistema",
  });
}
