import "server-only";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db, batch } from "@/db";
import {
  auditLog,
  clientObservations,
  clients,
  externos,
  jobCounters,
  jobItems,
  jobs,
  payments,
  serviceCategories,
  serviceItems,
  settings,
  users,
  type JobStatus,
  type PaymentMethod,
  type Urgency,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { addDays, limaInstant, todayLima, yearLima } from "@/lib/dates";
import { METHODS, METHOD_LABEL, STATUS_LABEL, URGENCIES, URGENCY_LABEL, academicTermFor, cycleFactor, formatPhone, jobCode, lineAmount, normalizePhone, normalizeText, round2 } from "@/lib/domain";
import { deleteFile, ensureBackupsFolder, getFile, listChildren, uploadSpreadsheet } from "@/lib/drive";
import { getSettings } from "@/lib/settings";
import { CONTINGENCY, buildContingencyWorkbook, buildDataWorkbook, type ExportData, type SheetRow } from "@/lib/sheets";

/* ---------- Exportar (RF-27) y respaldo (RF-32) ---------- */

export type ExportTables = { clientes: boolean; trabajos: boolean; pagos: boolean };
export type ExportRange = { from?: string | null; to?: string | null };

const STATUSES = Object.keys(STATUS_LABEL) as JobStatus[];
const KIND_LABEL = { pago: "Pago", devolucion: "Devolución" } as const;
const day = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(d) : null);
const dayTime = (d: Date | null | undefined) =>
  d ? `${day(d)} ${new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Lima" }).format(d)}` : null;

export async function countExport(range: ExportRange = {}) {
  const [c, j, p] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(clients).where(and(isNull(clients.deletedAt), inDays(clients.createdAt, range))),
    db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(and(isNull(jobs.deletedAt), inDays(jobs.createdAt, range))),
    db.select({ n: sql<number>`count(*)::int` }).from(payments).where(and(isNull(payments.deletedAt), inDays(payments.paidAt, range))),
  ]);
  return { clientes: c[0].n, trabajos: j[0].n, pagos: p[0].n };
}

function inDays(col: typeof clients.createdAt | typeof jobs.createdAt | typeof payments.paidAt, r: ExportRange) {
  return and(r.from ? gte(col, limaInstant(r.from)) : undefined, r.to ? lte(col, limaInstant(addDays(r.to, 1))) : undefined);
}

export async function loadExportData(range: ExportRange = {}, tables: ExportTables = { clientes: true, trabajos: true, pagos: true }): Promise<Partial<ExportData>> {
  const [clientRows, jobRows, paymentRows, people, exts, items, obs] = await Promise.all([
    tables.clientes ? db.select().from(clients).where(and(isNull(clients.deletedAt), inDays(clients.createdAt, range))).orderBy(asc(clients.name)) : [],
    tables.trabajos
      ? db
          .select({ job: jobs, whatsapp: clients.whatsapp })
          .from(jobs)
          .innerJoin(clients, eq(clients.id, jobs.clientId))
          .where(and(isNull(jobs.deletedAt), inDays(jobs.createdAt, range)))
          .orderBy(asc(jobs.year), asc(jobs.seq))
      : [],
    tables.pagos
      ? db
          .select({ p: payments, code: jobs.code, who: users.name })
          .from(payments)
          .innerJoin(jobs, eq(jobs.id, payments.jobId))
          .leftJoin(users, eq(users.id, payments.createdById))
          .where(and(isNull(payments.deletedAt), isNull(payments.voidedAt), inDays(payments.paidAt, range)))
          .orderBy(asc(payments.paidAt))
      : [],
    db.select({ id: users.id, name: users.name }).from(users),
    db.select({ id: externos.id, name: externos.name }).from(externos),
    tables.trabajos ? db.select({ jobId: jobItems.jobId, code: jobItems.code, quantity: jobItems.quantity, detail: jobItems.detail }).from(jobItems).orderBy(asc(jobItems.sortOrder)) : [],
    tables.clientes ? db.select({ clientId: clientObservations.clientId, body: clientObservations.body }).from(clientObservations).orderBy(asc(clientObservations.createdAt)) : [],
  ]);
  const codeById = new Map((await db.select({ id: jobs.id, code: jobs.code }).from(jobs)).map((j) => [j.id, j.code]));
  const name = new Map([...people, ...exts].map((p) => [p.id, p.name]));

  return {
    clients: !tables.clientes ? undefined : clientRows.map((c) => [
      c.name,
      formatPhone(c.whatsapp),
      c.university,
      c.career,
      c.cycle == null ? null : String(c.cycle),
      c.source,
      c.software,
      c.softwareVersion,
      c.usualFormat,
      obs.filter((o) => o.clientId === c.id).map((o) => o.body).join(" | ") || null,
    ]),
    jobs: !tables.trabajos ? undefined : jobRows.map(({ job: j, whatsapp }) => [
      j.code,
      formatPhone(whatsapp),
      items
        .filter((i) => i.jobId === j.id)
        .map((i) => `${i.code}${i.quantity > 1 ? ` x${i.quantity}` : ""}`)
        .join(", "),
      j.cycle,
      j.course,
      j.professor,
      j.section,
      j.academicTerm,
      j.title,
      dayTime(j.dueAt),
      URGENCY_LABEL[j.urgency],
      j.price,
      j.externoId ? (name.get(j.externoId) ?? null) : j.responsibleId ? (name.get(j.responsibleId) ?? null) : null,
      STATUS_LABEL[j.status],
      j.parentJobId ? (codeById.get(j.parentJobId) ?? null) : null,
      j.correctionRounds,
    ]),
    payments: !tables.pagos ? undefined : paymentRows.map(({ p, code, who }) => [code, KIND_LABEL[p.kind], p.amount, day(p.paidAt), METHOD_LABEL[p.method], p.operationNumber, p.reason ?? p.label, who]),
  };
}

/** Historial (RF-21) para la descarga desde la pestaña Historial. */
export async function loadHistoryRows(from: string) {
  const rows = await db
    .select({ at: auditLog.createdAt, who: users.name, entity: auditLog.entity, action: auditLog.action, summary: auditLog.summary, code: jobs.code })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .leftJoin(jobs, eq(jobs.id, auditLog.jobId))
    .where(gte(auditLog.createdAt, limaInstant(from)))
    .orderBy(desc(auditLog.createdAt));
  return rows.map((r) => [dayTime(r.at), r.who ?? "Sistema", r.code, r.entity, r.action, r.summary]);
}

/** RF-27: exporta como Google Sheets dentro de la carpeta raíz. */
export async function exportToDrive(range: ExportRange, tables: ExportTables) {
  const s = await getSettings();
  const data = await buildDataWorkbook(await loadExportData(range, tables));
  const suffix = range.from || range.to ? ` (${range.from ?? "inicio"} a ${range.to ?? "hoy"})` : "";
  return uploadSpreadsheet({ name: `Exportación ${todayLima()}${suffix}`, parentId: s.driveRootFolderId!, data });
}

/** Último código por prefijo, para la primera hoja de la contingencia (RF-33). */
async function lastCodes() {
  const year = yearLima();
  const s = await getSettings();
  const counter = await db.query.jobCounters.findFirst({ where: eq(jobCounters.year, year) });
  const lastSeq = counter?.last ?? s.codeStart - 1;
  const cats = await db.select().from(serviceCategories).orderBy(asc(serviceCategories.sortOrder));
  const rows = await db.select({ code: jobs.code, seq: jobs.seq }).from(jobs).where(eq(jobs.year, year));
  const prefixes = [...new Map(cats.map((c) => [c.prefix, c.name])).entries()];
  return {
    year,
    lastSeq,
    types: prefixes.map(([prefix, name]) => {
      const mine = rows.filter((r) => r.code.startsWith(prefix)).sort((a, b) => b.seq - a.seq)[0];
      return { name, prefix, lastCode: mine?.code ?? null, nextCode: jobCode(prefix, year, lastSeq + 1) };
    }),
  };
}

/** RF-32 y RF-33: respaldo diario en «Respaldos» (30 días) y la única planilla de contingencia. */
export async function runBackup() {
  const today = todayLima();
  const folderId = await ensureBackupsFolder();
  const backup = await uploadSpreadsheet({ name: `Respaldo ${today}`, parentId: folderId, data: await buildDataWorkbook(await loadExportData()) });

  const cutoff = addDays(today, -30);
  const removed: string[] = [];
  for (const f of await listChildren(folderId, "name contains 'Respaldo '")) {
    const m = /^Respaldo (\d{4}-\d{2}-\d{2})$/.exec(f.name);
    if (m && m[1] < cutoff) {
      await deleteFile(f.id);
      removed.push(f.name);
    }
  }

  const s = await getSettings();
  const contingency = await buildContingencyWorkbook({
    ...(await lastCodes()),
    updatedAt: new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeStyle: "short", timeZone: "America/Lima" }).format(new Date()),
  });
  let contingencyId = s.driveContingencyFileId;
  const existing = contingencyId ? await getFile(contingencyId) : null;
  if (existing && !existing.trashed) await uploadSpreadsheet({ name: "Planilla de contingencia", data: contingency, fileId: existing.id });
  else contingencyId = (await uploadSpreadsheet({ name: "Planilla de contingencia", parentId: folderId, data: contingency })).id;
  await db.update(settings).set({ driveContingencyFileId: contingencyId, lastBackupAt: new Date(), lastBackupOk: true }).where(eq(settings.id, 1));
  return { backupId: backup.id, removed };
}

/** Los respaldos que hay en Drive, del más reciente al más antiguo. */
export async function listBackups() {
  const folderId = await ensureBackupsFolder();
  const files = await listChildren(folderId, "name contains 'Respaldo '");
  return files
    .map((f) => ({ id: f.id, name: f.name, day: /(\d{4}-\d{2}-\d{2})/.exec(f.name)?.[1] ?? null, link: f.webViewLink ?? `https://docs.google.com/spreadsheets/d/${f.id}`, createdAt: f.createdTime ?? null }))
    .filter((f) => f.day)
    .sort((a, b) => b.day!.localeCompare(a.day!));
}

/* ---------- Lectura de lo escrito a mano ---------- */

function lookup<T extends string>(keys: readonly T[], labels: Record<T, string>) {
  const m = new Map<string, T>();
  for (const k of keys) {
    m.set(normalizeText(k), k);
    m.set(normalizeText(k.replace(/_/g, " ")), k);
    m.set(normalizeText(labels[k]), k);
  }
  return (v: string) => m.get(normalizeText(v));
}
const parseStatus = lookup<JobStatus>(STATUSES, STATUS_LABEL);
const parseUrgency = lookup<Urgency>(URGENCIES, URGENCY_LABEL);
const parseMethod = lookup<PaymentMethod>(METHODS, METHOD_LABEL);

function parseDay(v: string): string | null | undefined {
  if (!v) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(v);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}
function parseDateTime(v: string, defaultTime = "18:00"): Date | undefined {
  const d = parseDay(v);
  if (!d) return undefined;
  const t = /(\d{1,2}):(\d{2})/.exec(v.slice(8));
  return limaInstant(d, t ? `${t[1].padStart(2, "0")}:${t[2]}` : defaultTime);
}
function parseMoney(v: string): number | null | undefined {
  if (!v) return null;
  const clean = v.replace(/s\/|pen|\s/gi, "").replace(/,(?=\d{3}(\D|$))/g, "").replace(",", ".");
  return /^\d+(\.\d{1,2})?$/.test(clean) ? Number(clean) : undefined;
}
const get = (r: SheetRow, ...keys: string[]) => {
  for (const k of keys) if (r[k]?.trim()) return r[k].trim();
  return "";
};
const CODE_RE = /^([A-Z]{2})(\d{2})-(\d{1,6})$/;

/* ---------- Plan de importación (RF-28 y RF-34) ---------- */

export type PlanItem = { sheet: string; line: number; label: string; action: string; error?: string };
type Line = { serviceItemId: string; code: string; categoryCode: string; prefix: string; name: string; detail: string | null; unit: string; pricingMode: "fijo" | "ciclo"; basePrice: number; factor: number; quantity: number; hours: number; amount: number };
type ClientOp = { kind: "client"; whatsapp: string; data: Omit<typeof clients.$inferInsert, "id">; note: string | null };
type JobOp = {
  kind: "job";
  whatsapp: string;
  code: string | null;
  prefix: string;
  parentCode: string | null;
  lines: Line[];
  data: { title: string; cycle: number; course: string | null; professor: string | null; section: string | null; academicTerm: string | null; dueAt: Date; urgency: Urgency; urgencyPct: number; price: number; estimatedHours: number; status: JobStatus; responsibleId: string | null; externoId: string | null; correctionRounds: number };
};
type StatusOp = { kind: "status"; code: string; status: JobStatus; at: Date; who: string };
type PaymentOp = { kind: "payment"; code: string; amount: number; paidAt: Date; method: PaymentMethod; operationNumber: string | null; payKind: "pago" | "devolucion"; reason: string | null; who: string };
type Op = ClientOp | JobOp | StatusOp | PaymentOp;

export type ImportPlan = { items: PlanItem[]; ops: Op[]; errors: number };
type Sheets = Record<string, { rows: { line: number; values: SheetRow }[] }>;

async function context() {
  const [catalog, people, exts, cs, js, s] = await Promise.all([
    db.select({ item: serviceItems, cat: serviceCategories }).from(serviceItems).innerJoin(serviceCategories, eq(serviceCategories.id, serviceItems.categoryId)),
    db.select({ id: users.id, name: users.name, roles: users.roles }).from(users),
    db.select({ id: externos.id, name: externos.name }).from(externos),
    db.select({ id: clients.id, whatsapp: clients.whatsapp }).from(clients),
    db.select({ id: jobs.id, code: jobs.code, clientId: jobs.clientId, year: jobs.year, seq: jobs.seq }).from(jobs),
    getSettings(),
  ]);
  return {
    s,
    itemByCode: new Map(catalog.map((c) => [c.item.code.toUpperCase(), c])),
    custom: catalog.find((c) => c.cat.isCustom),
    person: (n: string) => people.find((p) => normalizeText(p.name) === normalizeText(n) || normalizeText(p.name.split(" ")[0]) === normalizeText(n)),
    externo: (n: string) => exts.find((e) => normalizeText(e.name) === normalizeText(n)),
    clientByWhatsapp: new Map(cs.map((c) => [c.whatsapp, c])),
    jobByCode: new Map(js.map((j) => [j.code, j])),
    seqTaken: new Set(js.map((j) => `${j.year}-${j.seq}`)),
  };
}

/** Arma el plan sin tocar la base. «planilla» lee Clientes, Trabajos y Pagos; «contingencia» las hojas de la sección 7.3. */
export async function buildPlan(sheets: Sheets, mode: "planilla" | "contingencia"): Promise<ImportPlan> {
  const ctx = await context();
  const items: PlanItem[] = [];
  const ops: Op[] = [];
  const newClients = new Set<string>();
  const newJobs = new Map<string, string>();
  const clientSheet = mode === "planilla" ? "Clientes" : CONTINGENCY.clients;
  const jobSheet = mode === "planilla" ? "Trabajos" : CONTINGENCY.jobs;
  const paySheet = mode === "planilla" ? "Pagos" : CONTINGENCY.payments;
  if (!sheets[clientSheet] && !sheets[jobSheet]) {
    return { items: [{ sheet: "—", line: 0, label: "Archivo", action: "", error: `No tiene las hojas «${clientSheet}» ni «${jobSheet}». Usa la plantilla del sistema.` }], ops: [], errors: 1 };
  }

  for (const { line, values: r } of sheets[clientSheet]?.rows ?? []) {
    const name = get(r, "Nombre");
    const whatsapp = normalizePhone(get(r, "WhatsApp"));
    const it: PlanItem = { sheet: clientSheet, line, label: name || "(sin nombre)", action: "Crear cliente" };
    items.push(it);
    const cycle = Number(get(r, "Ciclo"));
    if (name.length < 2) it.error = "Falta el nombre";
    else if (whatsapp.length !== 9) it.error = "WhatsApp no válido (9 dígitos)";
    else if (newClients.has(whatsapp)) it.error = "WhatsApp repetido en el archivo";
    else if (ctx.clientByWhatsapp.has(whatsapp)) {
      it.action = "Ya existe: se usa el registrado (RF-36)";
      continue;
    }
    if (it.error) continue;
    newClients.add(whatsapp);
    ops.push({
      kind: "client",
      whatsapp,
      note: get(r, "Observaciones") || null,
      data: {
        name,
        whatsapp,
        university: get(r, "Universidad") || null,
        career: get(r, "Carrera") || null,
        cycle: cycle >= 1 && cycle <= 10 ? Math.round(cycle) : null,
        source: get(r, "Cómo llegó") || null,
        software: get(r, "Software") || null,
        softwareVersion: get(r, "Versión") || null,
        usualFormat: get(r, "Formato habitual") || null,
        origin: mode === "planilla" ? "importacion" : "contingencia",
      },
    });
  }

  for (const { line, values: r } of sheets[jobSheet]?.rows ?? []) {
    const rawCode = get(r, "Código").toUpperCase().replace(/\s/g, "");
    const whatsapp = normalizePhone(get(r, "WhatsApp del cliente"));
    const title = get(r, "Descripción");
    const it: PlanItem = { sheet: jobSheet, line, label: rawCode || title.slice(0, 40) || "(sin datos)", action: rawCode ? `Crear ${rawCode}` : "Crear trabajo con código nuevo" };
    items.push(it);
    const m = rawCode ? CODE_RE.exec(rawCode) : null;
    const code = m ? jobCode(m[1], 2000 + Number(m[2]), Number(m[3])) : null;
    const cycleRaw = Number(get(r, "Ciclo", "Ciclo de la carrera") || 5);
    const cycle = cycleRaw >= 1 && cycleRaw <= 10 ? Math.round(cycleRaw) : NaN;
    const due = parseDateTime(get(r, "Fecha de entrega"));
    const price = parseMoney(get(r, "Precio"));
    const urgencyRaw = get(r, "Urgencia");
    const urgency = urgencyRaw ? parseUrgency(urgencyRaw) : "normal";
    const statusRaw = mode === "planilla" ? get(r, "Estado") : "";
    const status = statusRaw ? parseStatus(statusRaw) : "confirmado";
    const who = get(r, "Responsable");
    const person = who ? ctx.person(who) : null;
    const ext = who && !person ? ctx.externo(who) : null;
    const parentCode = get(r, "Relacionado con").toUpperCase().replace(/\s/g, "") || null;
    const rounds = Number(get(r, "Correcciones") || 0);

    // Ítems: «PL-02 x2, PL-06». Sin ítems, va como Personalizado con la descripción y el precio.
    const factor = Number.isFinite(cycle) ? cycleFactor(ctx.s.cycleFactors, cycle) : 1;
    const lines: Line[] = [];
    let itemError: string | null = null;
    for (const part of get(r, "Ítems", "Items").split(/[,;]/).map((x) => x.trim()).filter(Boolean)) {
      const pm = /^([A-Za-z]{2,3}-\d{1,2})\s*(?:[x×*]\s*(\d+))?$/.exec(part);
      const c = pm ? ctx.itemByCode.get(pm[1].toUpperCase()) : undefined;
      if (!c || c.cat.isCustom) {
        itemError = `El ítem «${part}» no está en el tarifario`;
        break;
      }
      const q = Number(pm![2] ?? 1);
      lines.push({ serviceItemId: c.item.id, code: c.item.code, categoryCode: c.cat.code, prefix: c.cat.prefix, name: c.item.name, detail: null, unit: c.item.unit, pricingMode: c.item.pricingMode, basePrice: c.item.basePrice, factor: c.item.pricingMode === "ciclo" ? factor : 1, quantity: q, hours: round2((c.item.hours ?? 0) * q), amount: lineAmount({ basePrice: c.item.basePrice, quantity: q, pricingMode: c.item.pricingMode }, factor) });
    }
    const pct = urgency ? ctx.s.urgency[urgency].pct : 0;
    const computed = round2(lines.reduce((a, l) => a + l.amount, 0) * (1 + pct / 100));
    const finalPrice = price ?? (lines.length ? computed : null);
    if (!lines.length && ctx.custom && finalPrice != null) {
      lines.push({ serviceItemId: ctx.custom.item.id, code: ctx.custom.item.code, categoryCode: ctx.custom.cat.code, prefix: ctx.custom.cat.prefix, name: ctx.custom.item.name, detail: title, unit: ctx.custom.item.unit, pricingMode: "fijo", basePrice: round2(finalPrice / (1 + pct / 100)), factor: 1, quantity: 1, hours: 0, amount: round2(finalPrice / (1 + pct / 100)) });
    }
    const prefix = m?.[1] ?? (lines.find((l) => l.categoryCode !== "OT")?.prefix ?? "OT");

    if (rawCode && !m) it.error = "Código no válido (formato PL26-014)";
    else if (code && (ctx.jobByCode.has(code) || newJobs.has(code))) it.error = `El código ${code} ya existe`;
    else if (code && ctx.seqTaken.has(`${2000 + Number(m![2])}-${Number(m![3])}`)) it.error = `El número ${Number(m![3])} de 20${m![2]} ya lo usa otro trabajo`;
    else if (whatsapp.length !== 9) it.error = "Falta el WhatsApp del cliente";
    else if (!ctx.clientByWhatsapp.has(whatsapp) && !newClients.has(whatsapp)) it.error = "El cliente no existe: agrégalo en la hoja de clientes";
    else if (title.length < 3) it.error = "Falta la descripción";
    else if (!Number.isFinite(cycle)) it.error = "Ciclo no válido (1 a 10)";
    else if (itemError) it.error = itemError;
    else if (!due) it.error = "Fecha de entrega no válida";
    else if (price === undefined) it.error = "Precio no válido";
    else if (finalPrice == null) it.error = "Falta el precio o los ítems";
    else if (!urgency) it.error = `Urgencia «${urgencyRaw}» no válida`;
    else if (!status) it.error = `Estado «${statusRaw}» no válido`;
    else if (who && !person && !ext) it.error = `«${who}» no está en Producción ni es un externo`;
    else if (parentCode && !ctx.jobByCode.has(parentCode) && !newJobs.has(parentCode)) it.error = `No existe el trabajo ${parentCode} para relacionarlo`;
    if (it.error || !due || !urgency || !status || finalPrice == null) continue;
    if (code) newJobs.set(code, whatsapp);
    ops.push({
      kind: "job",
      whatsapp,
      code,
      prefix,
      parentCode,
      lines,
      data: {
        title,
        cycle,
        course: get(r, "Curso") || null,
        professor: get(r, "Profesor") || null,
        section: get(r, "Sección") || null,
        academicTerm: get(r, "Ciclo académico") || academicTermFor(due),
        dueAt: due,
        urgency,
        urgencyPct: pct,
        price: finalPrice,
        estimatedHours: round2(lines.reduce((a, l) => a + l.hours, 0)),
        status,
        responsibleId: person?.id ?? null,
        externoId: ext?.id ?? null,
        correctionRounds: Number.isFinite(rounds) && rounds > 0 ? Math.floor(rounds) : 0,
      },
    });
  }

  const known = (code: string) => ctx.jobByCode.has(code) || newJobs.has(code);
  if (mode === "contingencia") {
    const rows = (sheets[CONTINGENCY.statuses]?.rows ?? []).map((x) => ({ ...x, at: parseDateTime(get(x.values, "Fecha y hora")) })).sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));
    for (const { line, values: r, at } of rows) {
      const code = get(r, "Código").toUpperCase().replace(/\s/g, "");
      const raw = get(r, "Nuevo estado");
      const status = parseStatus(raw);
      const it: PlanItem = { sheet: CONTINGENCY.statuses, line, label: code, action: `Cambiar a ${status ? STATUS_LABEL[status] : raw}` };
      items.push(it);
      if (!known(code)) it.error = `No existe el trabajo ${code}`;
      else if (!status) it.error = `Estado «${raw}» no válido`;
      else if (!at) it.error = "Fecha y hora no válida";
      if (it.error || !status || !at) continue;
      ops.push({ kind: "status", code, status, at, who: get(r, "Quién") });
    }
  }
  for (const { line, values: r } of sheets[paySheet]?.rows ?? []) {
    const code = get(r, "Código del trabajo").toUpperCase().replace(/\s/g, "");
    const amount = parseMoney(get(r, "Monto"));
    const methodRaw = get(r, "Medio");
    const method = parseMethod(methodRaw);
    const paidAt = parseDateTime(get(r, "Fecha"), "12:00");
    const payKind = normalizeText(get(r, "Tipo")).startsWith("devol") ? "devolucion" : "pago";
    const it: PlanItem = { sheet: paySheet, line, label: code, action: `Registrar ${payKind === "devolucion" ? "devolución" : "pago"} de S/ ${amount ?? "?"}` };
    items.push(it);
    if (!known(code)) it.error = `No existe el trabajo ${code}`;
    else if (!amount || amount <= 0) it.error = "Monto no válido";
    else if (!paidAt) it.error = "Fecha no válida";
    else if (!method) it.error = `Medio «${methodRaw}» no válido`;
    if (it.error || !amount || !paidAt || !method) continue;
    ops.push({ kind: "payment", code, amount, paidAt, method, operationNumber: get(r, "Número de operación") || null, payKind, reason: get(r, "Motivo") || null, who: get(r, "Quién lo registró", "Registrado por") });
  }

  return { items, ops, errors: items.filter((i) => i.error).length };
}

/** Aplica el plan. Todo en un solo batch: o entra todo o no entra nada. */
export async function applyPlan(plan: ImportPlan, meta: { userId: string; mode: "planilla" | "contingencia"; fileName: string; hash: string }) {
  const ctx = await context();
  const origin = meta.mode === "planilla" ? ("importacion" as const) : ("contingencia" as const);
  const q: unknown[] = [];
  const clientId = new Map<string, string>();
  for (const op of plan.ops) {
    if (op.kind !== "client") continue;
    const id = crypto.randomUUID();
    clientId.set(op.whatsapp, id);
    q.push(db.insert(clients).values({ id, ...op.data, createdById: meta.userId }));
    if (op.note) q.push(db.insert(clientObservations).values({ clientId: id, body: op.note, authorId: meta.userId }));
  }

  const year = yearLima();
  const counter = await db.query.jobCounters.findFirst({ where: eq(jobCounters.year, year) });
  let last = counter?.last ?? ctx.s.codeStart - 1;
  const jobId = new Map<string, string>();
  const created: string[] = [];
  for (const op of plan.ops) {
    if (op.kind !== "job") continue;
    const id = crypto.randomUUID();
    let code = op.code;
    let y = year;
    let seq: number;
    if (code) {
      const m = CODE_RE.exec(code)!;
      y = 2000 + Number(m[2]);
      seq = Number(m[3]);
      if (y === year) last = Math.max(last, seq);
    } else {
      do seq = ++last;
      while (ctx.seqTaken.has(`${year}-${seq}`));
      code = jobCode(op.prefix, year, seq);
    }
    jobId.set(code, id);
    created.push(code);
    const parent = op.parentCode ? (ctx.jobByCode.get(op.parentCode)?.id ?? jobId.get(op.parentCode) ?? null) : null;
    const cId = ctx.clientByWhatsapp.get(op.whatsapp)?.id ?? clientId.get(op.whatsapp)!;
    const taken = op.data.responsibleId || op.data.externoId ? op.data.dueAt : null;
    q.push(
      db.insert(jobs).values({ id, code, year: y, seq, clientId: cId, ...op.data, originalDueAt: op.data.dueAt, takenAt: taken, parentJobId: parent, origin, createdById: meta.userId, finishedAt: op.data.status === "finalizado" ? op.data.dueAt : null }),
    );
    op.lines.forEach((l, i) => q.push(db.insert(jobItems).values({ jobId: id, ...l, sortOrder: i, ...(["terminado", "en_revision", "finalizado"].includes(op.data.status) ? { doneAt: op.data.dueAt, doneById: op.data.responsibleId, doneByExternoId: op.data.externoId } : {}) })));
  }
  if (last !== (counter?.last ?? ctx.s.codeStart - 1)) q.push(db.insert(jobCounters).values({ year, last }).onConflictDoUpdate({ target: jobCounters.year, set: { last: sql`greatest(${jobCounters.last}, ${last})` } }));

  for (const op of plan.ops) {
    if (op.kind === "status") {
      const id = ctx.jobByCode.get(op.code)?.id ?? jobId.get(op.code)!;
      const by = ctx.person(op.who);
      q.push(db.update(jobs).set({ status: op.status, statusChangedAt: op.at, ...(op.status === "finalizado" ? { finishedAt: op.at } : {}) }).where(eq(jobs.id, id)));
      q.push(audit({ entity: "trabajo", entityId: id, jobId: id, action: "estado", summary: `pasó ${op.code} a ${STATUS_LABEL[op.status]} (contingencia)`, after: { status: op.status }, userId: by?.id ?? meta.userId, source: origin }));
    }
    if (op.kind === "payment") {
      const id = ctx.jobByCode.get(op.code)?.id ?? jobId.get(op.code)!;
      const by = ctx.person(op.who);
      q.push(db.insert(payments).values({ jobId: id, kind: op.payKind, amount: op.amount, paidAt: op.paidAt, method: op.method, operationNumber: op.operationNumber, reason: op.reason, label: op.payKind === "devolucion" ? "devolución" : "pago", origin, createdById: by?.id ?? meta.userId }));
    }
  }
  const counts = { clientes: clientId.size, trabajos: created.length, pagos: plan.ops.filter((o) => o.kind === "payment").length, estados: plan.ops.filter((o) => o.kind === "status").length };
  q.push(audit({ entity: "importacion", entityId: meta.hash.slice(0, 16), action: "importar", summary: `importó ${meta.fileName}: ${counts.clientes} clientes, ${counts.trabajos} trabajos, ${counts.pagos} pagos`, after: counts, userId: meta.userId, source: origin }));
  await batch(q as never);
  return { ...counts, codes: created };
}
