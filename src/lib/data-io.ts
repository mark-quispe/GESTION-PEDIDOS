import "server-only";
import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, jobCounters, jobs, payments, responsables, serviceTypes, settings, users, type JobStatus, type PaymentMethod, type RecordSource, type Urgency } from "@/db/schema";
import { audit } from "@/lib/audit";
import { todayLima, yearLima } from "@/lib/dates";
import {
  JOB_STATUSES,
  KIND_LABELS,
  METHOD_LABELS,
  PAYMENT_METHODS,
  STATUS_LABELS,
  URGENCIES,
  URGENCY_LABELS,
  formatJobCode,
  formatWhatsapp,
  normalizeText,
  normalizeWhatsapp,
} from "@/lib/domain";
import { createJobFolders, deleteFile, ensureBackupsFolder, getFile, getSettings, listChildren, uploadSpreadsheet } from "@/lib/drive";
import { bumpSeq, nextSeq } from "@/lib/queries";
import { CONTINGENCY, buildContingencyWorkbook, buildDataWorkbook, type ExportData, type SheetRow } from "@/lib/sheets";

/* ---------- Exportar (RF-27) y respaldo (RF-32) ---------- */

export async function loadExportData(range?: { from?: string | null; to?: string | null }): Promise<ExportData> {
  const from = range?.from ?? null;
  const to = range?.to ?? null;
  const createdIn = (col: typeof clients.createdAt | typeof jobs.createdAt) =>
    and(
      from ? gte(sql`(${col} at time zone 'America/Lima')::date`, from) : undefined,
      to ? lte(sql`(${col} at time zone 'America/Lima')::date`, to) : undefined,
    );

  const [clientRows, jobRows, paymentRows, people] = await Promise.all([
    db.select().from(clients).where(and(isNull(clients.deletedAt), createdIn(clients.createdAt))).orderBy(asc(clients.name)),
    db
      .select({ job: jobs, whatsapp: clients.whatsapp, prefix: serviceTypes.prefix, responsable: responsables.name })
      .from(jobs)
      .innerJoin(clients, eq(clients.id, jobs.clientId))
      .innerJoin(serviceTypes, eq(serviceTypes.id, jobs.serviceTypeId))
      .leftJoin(responsables, eq(responsables.id, jobs.responsableId))
      .where(and(isNull(jobs.deletedAt), createdIn(jobs.createdAt)))
      .orderBy(asc(jobs.year), asc(jobs.seq)),
    db
      .select({ p: payments, code: jobs.code, who: users.name, whoEmail: users.email })
      .from(payments)
      .innerJoin(jobs, eq(jobs.id, payments.jobId))
      .leftJoin(users, eq(users.id, payments.createdById))
      .where(and(isNull(payments.deletedAt), from ? gte(payments.paidOn, from) : undefined, to ? lte(payments.paidOn, to) : undefined))
      .orderBy(asc(payments.paidOn), asc(payments.createdAt)),
    db.select({ id: responsables.id, name: responsables.name }).from(responsables),
  ]);
  const codeById = new Map((await db.select({ id: jobs.id, code: jobs.code }).from(jobs)).map((j) => [j.id, j.code]));
  const responsableName = new Map(people.map((p) => [p.id, p.name]));

  return {
    clients: clientRows.map((c) => [
      c.name,
      formatWhatsapp(c.whatsapp),
      c.university,
      c.career,
      c.cycle,
      c.source,
      c.software,
      c.softwareVersion,
      c.usualFormat,
      c.observations,
    ]),
    jobs: jobRows.map(({ job: j, whatsapp, prefix, responsable }) => [
      j.code,
      formatWhatsapp(whatsapp),
      prefix,
      j.course,
      j.professor,
      j.section,
      j.academicTerm,
      j.description,
      j.dueDate,
      URGENCY_LABELS[j.urgency],
      j.price === null ? null : Number(j.price),
      responsable ?? (j.responsableId ? (responsableName.get(j.responsableId) ?? null) : null),
      STATUS_LABELS[j.status],
      j.parentJobId ? (codeById.get(j.parentJobId) ?? null) : null,
      j.correctionsCount,
    ]),
    payments: paymentRows.map(({ p, code, who, whoEmail }) => [
      code,
      KIND_LABELS[p.kind],
      Number(p.amount),
      p.paidOn,
      METHOD_LABELS[p.method],
      p.operationNumber,
      p.reason,
      who ?? whoEmail ?? null,
    ]),
  };
}

/** RF-27: exporta como Google Sheets dentro de la carpeta raíz. */
export async function exportToDrive(range?: { from?: string | null; to?: string | null }) {
  const s = await getSettings();
  const data = await buildDataWorkbook(await loadExportData(range));
  const suffix = range?.from || range?.to ? ` (${range.from ?? "inicio"} a ${range.to ?? "hoy"})` : "";
  return uploadSpreadsheet({ name: `Exportación ${todayLima()}${suffix}`, parentId: s.driveRootFolderId!, data });
}

/** Último código por tipo, para la primera hoja de la contingencia (RF-33). */
async function lastCodes() {
  const year = yearLima();
  const counter = await db.query.jobCounters.findFirst({ where: eq(jobCounters.year, year) });
  const s = await getSettings();
  const lastSeq = counter?.last ?? s.codeStart - 1;
  const types = await db.select().from(serviceTypes).where(eq(serviceTypes.active, true)).orderBy(asc(serviceTypes.name));
  const lastByType = await db
    .select({ serviceTypeId: jobs.serviceTypeId, seq: sql<number>`max(${jobs.seq})` })
    .from(jobs)
    .where(eq(jobs.year, year))
    .groupBy(jobs.serviceTypeId);
  const map = new Map(lastByType.map((r) => [r.serviceTypeId, Number(r.seq)]));
  return {
    year,
    lastSeq,
    types: types.map((t) => ({
      name: t.name,
      prefix: t.prefix,
      lastCode: map.has(t.id) ? formatJobCode(t.prefix, year, map.get(t.id)!) : null,
      nextCode: formatJobCode(t.prefix, year, lastSeq + 1),
    })),
  };
}

/**
 * RF-32 y RF-33: respaldo diario en "Respaldos" (se guardan 30 días) y
 * actualización de la única planilla de contingencia.
 */
export async function runBackup() {
  const today = todayLima();
  const folderId = await ensureBackupsFolder();
  const backup = await uploadSpreadsheet({ name: `Respaldo ${today}`, parentId: folderId, data: await buildDataWorkbook(await loadExportData()) });

  // Borra los respaldos de más de 30 días (solo los que creó el sistema, por su nombre).
  const children = await listChildren(folderId, "name contains 'Respaldo '");
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() - 30);
  const cutoff = limit.toISOString().slice(0, 10);
  const removed: string[] = [];
  for (const f of children) {
    const m = /^Respaldo (\d{4}-\d{2}-\d{2})$/.exec(f.name);
    if (m && m[1] < cutoff) {
      await deleteFile(f.id);
      removed.push(f.name);
    }
  }

  const s = await getSettings();
  const info = await lastCodes();
  const contingency = await buildContingencyWorkbook({
    ...info,
    updatedAt: new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" }).format(new Date()),
  });
  let contingencyId = s.driveContingencyFileId;
  const existing = contingencyId ? await getFile(contingencyId) : null;
  if (existing && !existing.trashed) {
    await uploadSpreadsheet({ name: "Planilla de contingencia", data: contingency, fileId: existing.id });
  } else {
    contingencyId = (await uploadSpreadsheet({ name: "Planilla de contingencia", parentId: folderId, data: contingency })).id;
  }
  await db.update(settings).set({ driveContingencyFileId: contingencyId, lastBackupAt: new Date() }).where(eq(settings.id, 1));
  return { backupId: backup.id, removed };
}

/* ---------- Lectura de valores escritos a mano ---------- */

function labelLookup<T extends string>(keys: readonly T[], labels: Record<T, string>) {
  const map = new Map<string, T>();
  for (const k of keys) {
    map.set(normalizeText(k), k);
    map.set(normalizeText(k.replace(/_/g, " ")), k);
    map.set(normalizeText(labels[k]), k);
  }
  return (v: string) => map.get(normalizeText(v));
}
const parseStatus = labelLookup<JobStatus>(JOB_STATUSES, STATUS_LABELS);
const parseUrgency = labelLookup<Urgency>(URGENCIES, URGENCY_LABELS);
const parseMethod = labelLookup<PaymentMethod>(PAYMENT_METHODS, METHOD_LABELS);

function parseDay(v: string): string | null | undefined {
  if (!v) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return undefined; // no válida
}

function parseDateTime(v: string): Date | undefined {
  const day = parseDay(v);
  if (!day) return undefined;
  const t = /(\d{1,2}):(\d{2})/.exec(v.slice(8));
  const hh = t ? t[1].padStart(2, "0") : "12";
  const mm = t ? t[2] : "00";
  return new Date(`${day}T${hh}:${mm}:00-05:00`);
}

function parseMoney(v: string): string | null | undefined {
  if (!v) return null;
  const clean = v.replace(/s\/|pen|\s/gi, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Number(clean).toFixed(2) : undefined;
}

const CODE_RE = /^([A-Z]{2})(\d{2})-(\d{1,6})$/;
const get = (r: SheetRow, ...keys: string[]) => {
  for (const k of keys) if (r[k]) return r[k].trim();
  return "";
};

/* ---------- Plan de importación (RF-28 y RF-34) ---------- */

export type PlanItem = { sheet: string; line: number; label: string; action: string; error?: string };

type ClientOp = { kind: "client"; data: typeof clients.$inferInsert };
type JobOp = { kind: "job"; whatsapp: string; parentCode: string | null; code: string | null; prefix: string; data: Omit<typeof jobs.$inferInsert, "id" | "code" | "year" | "seq" | "clientId" | "parentJobId"> };
type StatusOp = { kind: "status"; code: string; status: JobStatus; at: Date; who: string };
type PaymentOp = { kind: "payment"; code: string; data: Omit<typeof payments.$inferInsert, "jobId"> & { who: string } };
type Op = ClientOp | JobOp | StatusOp | PaymentOp;

export type ImportPlan = { items: PlanItem[]; ops: Op[]; errors: number };

type Sheets = Record<string, { rows: { line: number; values: SheetRow }[] }>;

async function context() {
  const [types, people, existingClients, existingJobs] = await Promise.all([
    db.select().from(serviceTypes),
    db.select().from(responsables),
    db.select({ id: clients.id, whatsapp: clients.whatsapp }).from(clients),
    db.select({ id: jobs.id, code: jobs.code, clientId: jobs.clientId, parentJobId: jobs.parentJobId, status: jobs.status }).from(jobs),
  ]);
  return {
    typeByKey: new Map(types.flatMap((t) => [[normalizeText(t.prefix), t] as const, [normalizeText(t.name), t] as const])),
    typeByPrefix: new Map(types.map((t) => [t.prefix, t])),
    personByName: new Map(people.map((p) => [normalizeText(p.name), p])),
    clientByWhatsapp: new Map(existingClients.map((c) => [c.whatsapp, c])),
    jobByCode: new Map(existingJobs.map((j) => [j.code, j])),
  };
}

/**
 * Arma el plan sin tocar la base de datos. `mode` decide qué hojas se leen:
 * "planilla" (Clientes, Trabajos) o "contingencia" (las cuatro hojas de 7.3).
 */
export async function buildPlan(sheets: Sheets, mode: "planilla" | "contingencia"): Promise<ImportPlan> {
  const ctx = await context();
  const items: PlanItem[] = [];
  const ops: Op[] = [];
  const newClients = new Set<string>();
  const newJobs = new Map<string, string>(); // código → whatsapp
  const jobClient = (code: string) => newJobs.get(code) ?? null;

  const clientSheet = mode === "planilla" ? "Clientes" : CONTINGENCY.clients;
  const jobSheet = mode === "planilla" ? "Trabajos" : CONTINGENCY.jobs;
  if (!sheets[clientSheet] && !sheets[jobSheet]) {
    return { items: [{ sheet: "—", line: 0, label: "Archivo", action: "", error: `No tiene las hojas "${clientSheet}" ni "${jobSheet}". Usa la plantilla del sistema.` }], ops: [], errors: 1 };
  }

  for (const { line, values: r } of sheets[clientSheet]?.rows ?? []) {
    const name = get(r, "Nombre");
    const whatsapp = normalizeWhatsapp(get(r, "WhatsApp"));
    const item: PlanItem = { sheet: clientSheet, line, label: name || "(sin nombre)", action: "Crear cliente" };
    items.push(item);
    if (name.length < 2) item.error = "Falta el nombre";
    else if (whatsapp.length < 9) item.error = "WhatsApp no válido";
    else if (newClients.has(whatsapp)) item.error = "WhatsApp repetido en el archivo";
    else if (ctx.clientByWhatsapp.has(whatsapp)) {
      item.action = "Ya existe: se usa el registrado (RF-36)";
      continue;
    }
    if (item.error) continue;
    newClients.add(whatsapp);
    ops.push({
      kind: "client",
      data: {
        name,
        whatsapp,
        university: get(r, "Universidad") || null,
        career: get(r, "Carrera") || null,
        cycle: get(r, "Ciclo") || null,
        source: get(r, "Cómo llegó") || null,
        software: get(r, "Software") || null,
        softwareVersion: get(r, "Versión") || null,
        usualFormat: get(r, "Formato habitual") || null,
        observations: get(r, "Observaciones") || null,
      },
    });
  }

  for (const { line, values: r } of sheets[jobSheet]?.rows ?? []) {
    const rawCode = get(r, "Código").toUpperCase().replace(/\s/g, "");
    const whatsapp = normalizeWhatsapp(get(r, "WhatsApp del cliente"));
    const description = get(r, "Descripción");
    const item: PlanItem = { sheet: jobSheet, line, label: rawCode || description.slice(0, 40) || "(sin datos)", action: rawCode ? `Crear ${rawCode}` : "Crear trabajo con código nuevo" };
    items.push(item);

    const m = rawCode ? CODE_RE.exec(rawCode) : null;
    const typeKey = get(r, "Tipo");
    const type = typeKey ? ctx.typeByKey.get(normalizeText(typeKey)) : m ? ctx.typeByPrefix.get(m[1]) : undefined;
    const code = m ? formatJobCode(m[1], 2000 + Number(m[2]), Number(m[3])) : null;
    const due = parseDay(get(r, "Fecha de entrega"));
    const price = parseMoney(get(r, "Precio"));
    const urgencyRaw = get(r, "Urgencia");
    const urgency = urgencyRaw ? parseUrgency(urgencyRaw) : "normal";
    const statusRaw = mode === "planilla" ? get(r, "Estado") : "";
    const status = statusRaw ? parseStatus(statusRaw) : mode === "contingencia" ? "confirmado" : "consulta";
    const personRaw = get(r, "Responsable");
    const person = personRaw ? ctx.personByName.get(normalizeText(personRaw)) : null;
    const parentCode = get(r, "Relacionado con").toUpperCase().replace(/\s/g, "") || null;
    const corrections = Number(get(r, "Correcciones") || 0);

    if (rawCode && !m) item.error = "Código no válido (formato PL26-014)";
    else if (code && (ctx.jobByCode.has(code) || newJobs.has(code))) item.error = `El código ${code} ya existe`;
    else if (!type) item.error = typeKey ? `Tipo "${typeKey}" no existe` : "Falta el tipo";
    else if (m && type.prefix !== m[1]) item.error = `El código ${code} no es del tipo ${type.prefix}`;
    else if (whatsapp.length < 9) item.error = "Falta el WhatsApp del cliente";
    else if (!ctx.clientByWhatsapp.has(whatsapp) && !newClients.has(whatsapp)) item.error = "El cliente no existe: agrégalo en la hoja de clientes";
    else if (description.length < 3) item.error = "Falta la descripción";
    else if (due === undefined) item.error = "Fecha de entrega no válida";
    else if (price === undefined) item.error = "Precio no válido";
    else if (!urgency) item.error = `Urgencia "${urgencyRaw}" no válida`;
    else if (!status) item.error = `Estado "${statusRaw}" no válido`;
    else if (personRaw && !person) item.error = `"${personRaw}" no está en la lista de responsables`;
    else if (parentCode) {
      const parent = ctx.jobByCode.get(parentCode);
      const parentWhatsapp = parent ? null : jobClient(parentCode);
      if (!parent && !parentWhatsapp) item.error = `No existe el trabajo ${parentCode} para relacionarlo`;
      else if (parentWhatsapp && parentWhatsapp !== whatsapp) item.error = "Solo se relaciona con trabajos del mismo cliente";
      else if (parent && ctx.clientByWhatsapp.get(whatsapp)?.id !== parent.clientId) item.error = "Solo se relaciona con trabajos del mismo cliente";
    }
    if (item.error || !type || !urgency || !status) continue;
    if (code) newJobs.set(code, whatsapp);
    ops.push({
      kind: "job",
      whatsapp,
      parentCode,
      code,
      prefix: type.prefix,
      data: {
        serviceTypeId: type.id,
        course: get(r, "Curso") || null,
        professor: get(r, "Profesor") || null,
        section: get(r, "Sección") || null,
        academicTerm: get(r, "Ciclo académico", "Ciclo") || null,
        description,
        dueDate: due ?? null,
        urgency,
        price: price ?? null,
        responsableId: person?.id ?? null,
        status,
        correctionsCount: Number.isFinite(corrections) && corrections > 0 ? Math.floor(corrections) : 0,
      },
    });
  }

  if (mode === "contingencia") {
    const knownCode = (code: string) => ctx.jobByCode.has(code) || newJobs.has(code);

    const statusRows = (sheets[CONTINGENCY.statuses]?.rows ?? [])
      .map((row) => ({ ...row, at: parseDateTime(get(row.values, "Fecha y hora")) }))
      .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
    for (const { line, values: r, at } of statusRows) {
      const code = get(r, "Código").toUpperCase().replace(/\s/g, "");
      const raw = get(r, "Nuevo estado");
      const status = parseStatus(raw);
      const item: PlanItem = { sheet: CONTINGENCY.statuses, line, label: code, action: `Cambiar a ${status ? STATUS_LABELS[status] : raw}` };
      items.push(item);
      if (!knownCode(code)) item.error = `No existe el trabajo ${code}`;
      else if (!status) item.error = `Estado "${raw}" no válido`;
      else if (!at) item.error = "Fecha y hora no válida";
      if (item.error || !status || !at) continue;
      ops.push({ kind: "status", code, status, at, who: get(r, "Quién") });
    }

    const paymentRows = (sheets[CONTINGENCY.payments]?.rows ?? [])
      .map((row) => ({ ...row, day: parseDay(get(row.values, "Fecha")) }))
      .sort((a, b) => (a.day ?? "").localeCompare(b.day ?? ""));
    for (const { line, values: r, day } of paymentRows) {
      const code = get(r, "Código del trabajo").toUpperCase().replace(/\s/g, "");
      const amount = parseMoney(get(r, "Monto"));
      const methodRaw = get(r, "Medio");
      const method = parseMethod(methodRaw);
      const item: PlanItem = { sheet: CONTINGENCY.payments, line, label: code, action: `Registrar pago de S/ ${amount ?? "?"}` };
      items.push(item);
      if (!knownCode(code)) item.error = `No existe el trabajo ${code}`;
      else if (!amount || Number(amount) <= 0) item.error = "Monto no válido";
      else if (!day) item.error = "Fecha no válida";
      else if (!method) item.error = `Medio "${methodRaw}" no válido`;
      if (item.error || !amount || !day || !method) continue;
      ops.push({
        kind: "payment",
        code,
        data: { kind: "pago", amount, paidOn: day, method, operationNumber: get(r, "Número de operación") || null, who: get(r, "Quién lo registró") },
      });
    }
  }

  return { items, ops, errors: items.filter((i) => i.error).length };
}

/** Aplica el plan en orden: clientes, trabajos, cambios de estado y pagos (RF-34). */
export async function applyPlan(plan: ImportPlan, opts: { userId: string; source: RecordSource; createFolders: boolean }) {
  const ctx = await context();
  const clientIds = new Map([...ctx.clientByWhatsapp].map(([w, c]) => [w, c.id]));
  const jobsByCode = new Map([...ctx.jobByCode].map(([code, j]) => [code, { id: j.id, parentJobId: j.parentJobId, status: j.status }]));
  const created = { clients: 0, jobs: 0, statuses: 0, payments: 0 };
  const newJobIds: string[] = [];

  for (const op of plan.ops) {
    if (op.kind === "client") {
      if (clientIds.has(op.data.whatsapp)) continue;
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(clients).values({ ...op.data, id, origin: opts.source, createdById: opts.userId }),
        audit({ entity: "cliente", entityId: id, action: "crear", after: op.data, userId: opts.userId, source: opts.source }),
      ]);
      clientIds.set(op.data.whatsapp, id);
      created.clients++;
    } else if (op.kind === "job") {
      const clientId = clientIds.get(op.whatsapp)!;
      let year: number;
      let seq: number;
      if (op.code) {
        const m = CODE_RE.exec(op.code)!;
        year = 2000 + Number(m[2]);
        seq = Number(m[3]);
        await bumpSeq(year, seq); // respeta el código y adelanta el correlativo
      } else {
        year = yearLima();
        seq = await nextSeq(year);
      }
      const code = op.code ?? formatJobCode(op.prefix, year, seq);
      const parent = op.parentCode ? jobsByCode.get(op.parentCode) : null;
      const parentJobId = parent ? (parent.parentJobId ?? parent.id) : null;
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(jobs).values({ ...op.data, id, code, year, seq, clientId, parentJobId, origin: opts.source, createdById: opts.userId }),
        audit({ entity: "trabajo", entityId: id, jobId: id, action: "crear", after: { ...op.data, code }, userId: opts.userId, source: opts.source }),
      ]);
      jobsByCode.set(code, { id, parentJobId, status: op.data.status ?? "consulta" });
      newJobIds.push(id);
      created.jobs++;
    } else if (op.kind === "status") {
      const job = jobsByCode.get(op.code)!;
      const current = await db.query.jobs.findFirst({ where: eq(jobs.id, job.id), columns: { status: true, correctionsCount: true } });
      if (!current || current.status === op.status) continue;
      await db.batch([
        db
          .update(jobs)
          .set({
            status: op.status,
            correctionsCount: op.status === "correcciones" ? current.correctionsCount + 1 : current.correctionsCount,
            ...(op.status === "entregado" ? { deliveredAt: op.at } : {}),
          })
          .where(eq(jobs.id, job.id)),
        audit({ entity: "trabajo", entityId: job.id, jobId: job.id, action: "estado", before: current.status, after: { estado: op.status, fecha: op.at, quien: op.who }, userId: opts.userId, source: opts.source }),
      ]);
      created.statuses++;
    } else {
      const job = jobsByCode.get(op.code)!;
      const { who, ...data } = op.data;
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(payments).values({ ...data, id, jobId: job.id, origin: opts.source, createdById: opts.userId }),
        audit({ entity: "pago", entityId: id, jobId: job.id, action: "crear", after: { ...data, quien: who }, userId: opts.userId, source: opts.source }),
      ]);
      created.payments++;
    }
  }

  // RF-34: crea en Drive las carpetas de los trabajos nuevos.
  const folderErrors: string[] = [];
  if (opts.createFolders) {
    for (const id of newJobIds) {
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, id),
        columns: { id: true, code: true, description: true, parentJobId: true },
        with: { client: { columns: { name: true } } },
      });
      try {
        if (job) await createJobFolders(job);
      } catch {
        folderErrors.push(job?.code ?? id);
      }
    }
  }
  return { created, folderErrors };
}
