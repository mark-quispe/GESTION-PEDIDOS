import "server-only";
import { desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, clients, jobs, users } from "@/db/schema";
import { addDays, startOfDayLima, todayLima } from "@/lib/dates";

export type HistoryGroup = "estados" | "precios" | "pagos" | "eliminados" | "tomados" | "items" | "accesos" | "otros";

export type HistoryRow = {
  id: string;
  at: string;
  group: HistoryGroup;
  action: string;
  summary: string;
  before: unknown;
  after: unknown;
  userId: string | null;
  userName: string;
  jobCode: string | null;
  jobTitle: string | null;
  clientName: string | null;
};

export function groupOf(entity: string, action: string): HistoryGroup {
  if (action === "eliminar" || action === "restaurar") return "eliminados";
  if (entity === "pago") return "pagos";
  if (action === "tomar" || action === "soltar" || action === "asignar") return "tomados";
  if (entity === "item" || action === "item") return "items";
  if (entity === "sesion" || entity === "usuario") return "accesos";
  if (action === "precio" || entity === "servicio" || action === "urgencia" || action === "factor") return "precios";
  if (entity === "trabajo" && ["estado", "anular", "reabrir", "confirmar", "correccion"].includes(action)) return "estados";
  return "otros";
}

/** RF-21 / RNF-24: el historial del último mes (31 días), lo más reciente primero. */
export async function getHistory() {
  const since = startOfDayLima(addDays(todayLima(), -31));
  const rows = await db
    .select({
      id: auditLog.id,
      at: auditLog.createdAt,
      entity: auditLog.entity,
      action: auditLog.action,
      summary: auditLog.summary,
      before: auditLog.before,
      after: auditLog.after,
      userId: auditLog.userId,
      userName: users.name,
      jobCode: jobs.code,
      jobTitle: jobs.title,
      clientName: clients.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .leftJoin(jobs, eq(jobs.id, auditLog.jobId))
    .leftJoin(clients, eq(clients.id, jobs.clientId))
    .where(gte(auditLog.createdAt, since))
    .orderBy(desc(auditLog.createdAt))
    .limit(1500);
  return rows.map<HistoryRow>((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    group: groupOf(r.entity, r.action),
    action: r.action,
    summary: r.summary ?? r.action,
    before: r.before,
    after: r.after,
    userId: r.userId,
    userName: r.userName ?? "Sistema",
    jobCode: r.jobCode,
    jobTitle: r.jobTitle,
    clientName: r.clientName,
  }));
}
