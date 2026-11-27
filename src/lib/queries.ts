import "server-only";
import { and, desc, eq, isNull, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clients, jobCounters, jobs, payments, responsables, serviceTypes, settings } from "@/db/schema";
import { CLOSED_STATUSES, balance, isLate, normalizeText, paymentStatus } from "@/lib/domain";
import { todayLima } from "@/lib/dates";

/** RF-16: total pagado (pagos menos devoluciones, sin los eliminados). */
export const paidExpr = sql<string>`coalesce((
  select sum(case when p.kind = 'pago' then p.amount else -p.amount end)
  from ${payments} p
  where p.job_id = ${jobs.id} and p.deleted_at is null
), 0)`;

/**
 * RF-08: siguiente número del año. Una sola sentencia atómica, así dos personas
 * que crean un trabajo al mismo tiempo nunca reciben el mismo número.
 */
export async function nextSeq(year: number): Promise<number> {
  const s = await db.query.settings.findFirst({ where: eq(settings.id, 1), columns: { codeStart: true } });
  const start = s?.codeStart ?? 1;
  const [row] = await db
    .insert(jobCounters)
    .values({ year, last: start })
    .onConflictDoUpdate({ target: jobCounters.year, set: { last: sql`greatest(${jobCounters.last} + 1, ${start})` } })
    .returning({ last: jobCounters.last });
  return row.last;
}

/** RF-34: al importar un código escrito a mano, el correlativo se adelanta para no repetirlo. */
export async function bumpSeq(year: number, seq: number) {
  await db
    .insert(jobCounters)
    .values({ year, last: seq })
    .onConflictDoUpdate({ target: jobCounters.year, set: { last: sql`greatest(${jobCounters.last}, ${seq})` } });
}

export type JobListRow = {
  id: string;
  code: string;
  status: (typeof jobs.$inferSelect)["status"];
  urgency: (typeof jobs.$inferSelect)["urgency"];
  description: string;
  course: string | null;
  dueDate: string | null;
  price: string | null;
  paid: string;
  balance: number;
  paymentStatus: ReturnType<typeof paymentStatus>;
  late: boolean;
  correctionsCount: number;
  clientId: string;
  clientName: string;
  serviceType: string;
  prefix: string;
  responsableId: string | null;
  responsable: string | null;
  parentJobId: string | null;
  createdAt: string;
};

export async function listJobs(where?: SQL): Promise<JobListRow[]> {
  const today = todayLima();
  const rows = await db
    .select({
      id: jobs.id,
      code: jobs.code,
      status: jobs.status,
      urgency: jobs.urgency,
      description: jobs.description,
      course: jobs.course,
      dueDate: jobs.dueDate,
      price: jobs.price,
      paid: paidExpr,
      correctionsCount: jobs.correctionsCount,
      clientId: jobs.clientId,
      clientName: clients.name,
      serviceType: serviceTypes.name,
      prefix: serviceTypes.prefix,
      responsableId: jobs.responsableId,
      responsable: responsables.name,
      parentJobId: jobs.parentJobId,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .innerJoin(clients, eq(clients.id, jobs.clientId))
    .innerJoin(serviceTypes, eq(serviceTypes.id, jobs.serviceTypeId))
    .leftJoin(responsables, eq(responsables.id, jobs.responsableId))
    .where(and(isNull(jobs.deletedAt), where))
    .orderBy(desc(jobs.year), desc(jobs.seq))
    .limit(2000);

  return rows.map((r) => ({
    ...r,
    paid: String(r.paid),
    balance: r.status === "cancelado" ? 0 : balance(r.price, r.paid),
    paymentStatus: paymentStatus(r.price, r.paid),
    late: isLate(r.status, r.dueDate, today),
    createdAt: r.createdAt.toISOString(),
  }));
}

/** RF-46: trabajos del cliente con saldo pendiente. */
export async function clientDebts(clientId: string) {
  const rows = await listJobs(and(eq(jobs.clientId, clientId), ne(jobs.status, "cancelado")));
  return rows.filter((r) => r.balance > 0).map((r) => ({ id: r.id, code: r.code, balance: r.balance }));
}

export type JobWarnings = {
  /** RF-35 */
  sameCourse: { id: string; code: string; clientName: string; responsable: string | null; status: string; level: "seguro" | "posible" }[];
  /** RF-37 */
  repeated: { id: string; code: string; course: string | null; serviceType: string }[];
  /** RF-46 */
  debts: { id: string; code: string; balance: number }[];
};

export async function jobWarnings(input: {
  clientId: string;
  serviceTypeId?: string | null;
  course?: string | null;
  professor?: string | null;
  academicTerm?: string | null;
}): Promise<JobWarnings> {
  const client = await db.query.clients.findFirst({ where: eq(clients.id, input.clientId), columns: { university: true } });
  const out: JobWarnings = { sameCourse: [], repeated: [], debts: [] };
  if (!client) return out;

  const course = normalizeText(input.course);

  // RF-37: el cliente ya tiene un trabajo abierto del mismo curso o tipo de servicio.
  const openOfClient = await db
    .select({ id: jobs.id, code: jobs.code, course: jobs.course, serviceTypeId: jobs.serviceTypeId, serviceType: serviceTypes.name })
    .from(jobs)
    .innerJoin(serviceTypes, eq(serviceTypes.id, jobs.serviceTypeId))
    .where(and(eq(jobs.clientId, input.clientId), isNull(jobs.deletedAt), notInArray(jobs.status, CLOSED_STATUSES)));
  out.repeated = openOfClient
    .filter((j) => (input.serviceTypeId && j.serviceTypeId === input.serviceTypeId) || (course && normalizeText(j.course) === course))
    .map(({ id, code, course, serviceType }) => ({ id, code, course, serviceType }));

  // RF-35: otros clientes con el mismo curso y universidad (y profesor y ciclo si están llenos).
  const university = normalizeText(client.university);
  if (course && university) {
    const candidates = await db
      .select({
        id: jobs.id,
        code: jobs.code,
        course: jobs.course,
        professor: jobs.professor,
        academicTerm: jobs.academicTerm,
        status: jobs.status,
        clientName: clients.name,
        university: clients.university,
        responsable: responsables.name,
      })
      .from(jobs)
      .innerJoin(clients, eq(clients.id, jobs.clientId))
      .leftJoin(responsables, eq(responsables.id, jobs.responsableId))
      .where(and(isNull(jobs.deletedAt), ne(jobs.clientId, input.clientId), ne(jobs.status, "cancelado")))
      .orderBy(desc(jobs.createdAt))
      .limit(1000);

    const professor = normalizeText(input.professor);
    const term = normalizeText(input.academicTerm);
    for (const c of candidates) {
      if (normalizeText(c.course) !== course || normalizeText(c.university) !== university) continue;
      let extraMatches = 0;
      let mismatch = false;
      for (const [mine, theirs] of [
        [professor, normalizeText(c.professor)],
        [term, normalizeText(c.academicTerm)],
      ]) {
        if (!mine || !theirs) continue; // solo se comparan los datos llenos
        if (mine === theirs) extraMatches++;
        else mismatch = true;
      }
      if (mismatch) continue;
      out.sameCourse.push({
        id: c.id,
        code: c.code,
        clientName: c.clientName,
        responsable: c.responsable,
        status: c.status,
        level: extraMatches > 0 ? "seguro" : "posible",
      });
    }
  }

  out.debts = await clientDebts(input.clientId);
  return out;
}

/** RF-39: la relación siempre apunta al original. */
export async function resolveRootJob(jobId: string, clientId: string) {
  const job = await db.query.jobs.findFirst({
    where: and(eq(jobs.id, jobId), isNull(jobs.deletedAt)),
    columns: { id: true, clientId: true, parentJobId: true },
  });
  if (!job || job.clientId !== clientId) return null;
  return job.parentJobId ?? job.id;
}

export async function activeCatalogs() {
  const [types, people] = await Promise.all([
    db.select().from(serviceTypes).orderBy(serviceTypes.name),
    db.select().from(responsables).orderBy(responsables.name),
  ]);
  return { serviceTypes: types, responsables: people };
}

/** Grupo de un trabajo original: él mismo y sus relacionados. */
export async function jobGroup(rootId: string) {
  return listJobs(or(eq(jobs.id, rootId), eq(jobs.parentJobId, rootId)));
}

