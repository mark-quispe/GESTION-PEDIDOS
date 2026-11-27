/**
 * Datos iniciales.
 * - Siempre: configuración, tarifario y el primer admin (ADMIN_EMAIL).
 * - En la base local y en la demo (RF-53): un estudio ficticio con fechas
 *   relativas a hoy, para que Inicio, Agenda y Estadísticas tengan vida.
 * Los correos *.test son de prueba: solo sirven con el acceso de desarrollo.
 */
import { sql } from "drizzle-orm";
import type { DB } from "./index";
import {
  clientObservations,
  clients,
  externos,
  jobCounters,
  jobItems,
  jobNotes,
  jobs,
  payments,
  serviceCategories,
  serviceItems,
  settings,
  users,
  type JobStatus,
  type PaymentMethod,
  type Urgency,
} from "./schema";
import { DEFAULT_CYCLE_FACTORS, DEFAULT_URGENCY, TARIFARIO, toPricingMode } from "./tarifario";
import { academicTermFor, computeTotal, cycleFactor, jobCode, lineAmount } from "../lib/domain";

export const DEMO_USERS = {
  admin: { email: "mark@estudio.test", name: "Mark Quispe", roles: ["admin"] },
  ana: { email: "ana@estudio.test", name: "Ana Torres", roles: ["empleado", "produccion"] },
  luis: { email: "luis@estudio.test", name: "Luis Paredes", roles: ["produccion"] },
  carla: { email: "carla@estudio.test", name: "Carla Díaz", roles: ["empleado"] },
} as const;

export async function seedIfEmpty(db: DB, opts: { demo?: boolean } = { demo: true }) {
  const rows = await db.select({ n: sql<number>`count(*)::int` }).from(settings);
  if (rows[0]?.n) return;
  await seedBase(db);
  if (opts.demo) await seedDemo(db);
}

async function seedBase(db: DB) {
  await db.insert(settings).values({
    id: 1,
    studioName: process.env.NEXT_PUBLIC_STUDIO_NAME || "Estudio",
    urgency: DEFAULT_URGENCY,
    cycleFactors: DEFAULT_CYCLE_FACTORS,
    alerts: { quoteDays: 2, pendingDays: 3, driveFullPct: 90, backupFailed: true },
    whatsapp: "946779608",
    facebook: "https://facebook.com/trampil",
    instagram: "https://instagram.com/trampil",
  });

  for (const [i, cat] of TARIFARIO.entries()) {
    const [c] = await db
      .insert(serviceCategories)
      .values({ code: cat.code, prefix: cat.prefix, name: cat.name, sortOrder: i, isCustom: !!cat.isCustom })
      .returning({ id: serviceCategories.id });
    await db.insert(serviceItems).values(
      cat.items.map(([code, name, includes, unit, hours, mode, price, starred], j) => ({
        categoryId: c.id,
        code,
        name,
        includes,
        unit,
        hours,
        pricingMode: toPricingMode(mode),
        basePrice: price,
        starred: !!starred,
        sortOrder: j,
      })),
    );
  }

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (adminEmail) await db.insert(users).values({ email: adminEmail, name: "Administrador", roles: ["admin"] }).onConflictDoNothing();
}

/* ---------- Estudio ficticio ---------- */

type JobSpec = {
  client: string;
  title: string;
  items: [code: string, qty: number, done?: boolean][];
  dueInDays: number;
  dueTime: string;
  urgency?: Urgency;
  status: JobStatus;
  who?: keyof typeof DEMO_USERS | "externo" | null;
  paid?: number | "all" | "half";
  method?: PaymentMethod;
  createdDaysAgo?: number;
  course?: string;
  professor?: string;
  rounds?: number;
};

const CLIENTS = [
  { name: "Lucía Huamán", whatsapp: "987654321", university: "UNI", career: "Arquitectura", cycle: 6, source: "Instagram", software: "AutoCAD 2024", usualFormat: "DWG + PDF" },
  { name: "Diego Ramos", whatsapp: "912345678", university: "URP", career: "Arquitectura", cycle: 8, source: "Recomendación" },
  { name: "Valeria Ccori", whatsapp: "934567812", university: "UNFV", career: "Arquitectura", cycle: 4, source: "Facebook" },
  { name: "Jorge Mamani", whatsapp: "956781234", university: "UNI", career: "Arquitectura", cycle: 7, source: "Recomendación", software: "Revit 2023" },
  { name: "Sofía Paredes", whatsapp: "978123456", university: "PUCP", career: "Arquitectura", cycle: 5, source: "Instagram" },
  { name: "Bruno Salazar", whatsapp: "990123456", university: "USMP", career: "Arquitectura", cycle: 9, source: "TikTok" },
  { name: "Camila Rojas", whatsapp: "945612378", university: "UPC", career: "Arquitectura", cycle: 3, source: "Instagram" },
  { name: "Andrea Quispe", whatsapp: "923456789", university: "UNI", career: "Arquitectura", cycle: 2, source: "WhatsApp" },
  { name: "Renzo Torres", whatsapp: "967812345", university: "URP", career: "Ingeniería Civil", cycle: 6, source: "Recomendación" },
  { name: "Tomás Rivas", whatsapp: "981234567", university: "UCV", career: "Arquitectura", cycle: 10, source: "Facebook" },
];

const JOBS: JobSpec[] = [
  { client: "Andrea Quispe", title: "Panel de terreno con curvas", items: [["PA-01", 1], ["TO-01", 1]], dueInDays: -2, dueTime: "18:00", status: "en_proceso", who: "luis", paid: "half", createdDaysAgo: 9, course: "Taller de Diseño II" },
  { client: "Renzo Torres", title: "Plano de distribución de hostal", items: [["PL-03", 2, true], ["PL-07", 2]], dueInDays: -1, dueTime: "20:00", urgency: "alta", status: "en_proceso", who: "ana", paid: "all", createdDaysAgo: 6 },
  { client: "Lucía Huamán", title: "Planos de vivienda unifamiliar", items: [["PC-01", 1, true], ["PC-02", 1, true], ["PL-06", 1]], dueInDays: 0, dueTime: "18:00", urgency: "urgente", status: "en_proceso", who: "admin", paid: 240, createdDaysAgo: 4, course: "Taller de Arquitectura III", professor: "Arq. Salas", rounds: 0 },
  { client: "Diego Ramos", title: "Panel A1 centro cultural", items: [["PA-01", 1]], dueInDays: 0, dueTime: "20:00", urgency: "alta", status: "confirmado", who: null, paid: "all", createdDaysAgo: 3 },
  { client: "Valeria Ccori", title: "Elevaciones de mercado", items: [["PL-07", 2]], dueInDays: 0, dueTime: "23:59", status: "en_proceso", who: "luis", paid: 40, createdDaysAgo: 5 },
  { client: "Tomás Rivas", title: "Plano de remodelación", items: [["PL-02", 1], ["PL-04", 1]], dueInDays: 0, dueTime: "21:00", urgency: "urgente", status: "confirmado", who: null, paid: "half", createdDaysAgo: 1 },
  { client: "Jorge Mamani", title: "Cortes y elevaciones biblioteca", items: [["PL-06", 2, true], ["PL-07", 2, true], ["MD-03", 1]], dueInDays: 1, dueTime: "12:00", urgency: "alta", status: "confirmado", who: null, paid: "half", createdDaysAgo: 4 },
  { client: "Lucía Huamán", title: "Lámina de zonificación", items: [["LG-06", 2]], dueInDays: 1, dueTime: "18:00", urgency: "alta", status: "terminado", who: "ana", paid: "all", createdDaysAgo: 3 },
  { client: "Sofía Paredes", title: "Panel volumétrico", items: [["PA-03", 1], ["LG-02", 1]], dueInDays: 2, dueTime: "09:00", status: "confirmado", who: null, paid: "half", createdDaysAgo: 2 },
  { client: "Bruno Salazar", title: "Modelado 3D de vivienda", items: [["MD-01", 1], ["MD-03", 2]], dueInDays: 2, dueTime: "17:00", status: "en_proceso", who: "ana", paid: "half", createdDaysAgo: 3 },
  { client: "Camila Rojas", title: "Planta amoblada departamento", items: [["PL-02", 1], ["PL-04", 1]], dueInDays: 2, dueTime: "22:00", status: "en_revision", who: "luis", paid: "all", createdDaysAgo: 6 },
  { client: "Andrea Quispe", title: "Maqueta conceptual", items: [["MQ-01", 1]], dueInDays: 3, dueTime: "14:00", status: "confirmado", who: null, paid: "half", createdDaysAgo: 1 },
  { client: "Diego Ramos", title: "Expediente de detalles", items: [["DE-03", 1], ["DE-04", 2]], dueInDays: 5, dueTime: "19:00", status: "en_proceso", who: "luis", paid: "half", createdDaysAgo: 2 },
  { client: "Renzo Torres", title: "Memoria descriptiva", items: [["DOC-01", 1]], dueInDays: 6, dueTime: "23:00", status: "confirmado", who: "externo", paid: "half", createdDaysAgo: 1 },
  { client: "Camila Rojas", title: "Recorrido virtual de vivienda", items: [["MD-01", 1], ["MD-06", 2]], dueInDays: 9, dueTime: "18:00", status: "cotizacion", createdDaysAgo: 5 },
  { client: "Bruno Salazar", title: "Expediente de licencia", items: [["PL-01", 1], ["PL-02", 3], ["PL-06", 2], ["DOC-01", 1]], dueInDays: 11, dueTime: "18:00", status: "cotizacion", createdDaysAgo: 3 },
  { client: "Sofía Paredes", title: "Panel de emplazamiento", items: [["PA-01", 1], ["LG-08", 1]], dueInDays: 8, dueTime: "18:00", status: "cotizacion", createdDaysAgo: 2 },
  { client: "Jorge Mamani", title: "Plano de techos", items: [["PL-05", 2]], dueInDays: -6, dueTime: "18:00", status: "finalizado", who: "ana", paid: "all", createdDaysAgo: 12 },
  { client: "Valeria Ccori", title: "Lámina de análisis de sitio", items: [["LG-07", 1]], dueInDays: -4, dueTime: "12:00", status: "finalizado", who: "luis", paid: "all", createdDaysAgo: 9 },
  { client: "Lucía Huamán", title: "Plano cero de vivienda", items: [["PC-01", 2], ["PC-02", 2]], dueInDays: -9, dueTime: "18:00", status: "finalizado", who: "admin", paid: "all", createdDaysAgo: 15 },
  { client: "Tomás Rivas", title: "Render interior sala", items: [["MD-04", 3]], dueInDays: -3, dueTime: "18:00", status: "cancelado", who: null, paid: 0, createdDaysAgo: 8 },
];

export async function seedDemo(db: DB) {
  const now = new Date();
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric" }).format(now));
  const day = (offset: number, time: string) => {
    const base = new Date(now.getTime() - 5 * 3_600_000);
    base.setUTCDate(base.getUTCDate() + offset);
    return new Date(`${base.toISOString().slice(0, 10)}T${time}:00-05:00`);
  };

  const userIds: Record<string, string> = {};
  for (const [key, u] of Object.entries(DEMO_USERS)) {
    const [row] = await db
      .insert(users)
      .values({ email: u.email, name: u.name, roles: [...u.roles], phone: "9" + String(Math.abs(hash(u.name))).slice(0, 8) })
      .onConflictDoUpdate({ target: users.email, set: { name: u.name } })
      .returning({ id: users.id });
    userIds[key] = row.id;
  }
  const [ext] = await db
    .insert(externos)
    .values({ name: "Jhon Vargas", phone: "955444333", note: "Arquitecto independiente. Avisarle con 2 días.", skills: ["DOC-01", "DOC-04", "PL-01"], createdById: userIds.admin })
    .returning({ id: externos.id });

  const clientIds: Record<string, { id: string; cycle: number; university: string }> = {};
  for (const c of CLIENTS) {
    const [row] = await db
      .insert(clients)
      .values({ ...c, origin: "demo", createdById: userIds.carla })
      .returning({ id: clients.id });
    clientIds[c.name] = { id: row.id, cycle: c.cycle, university: c.university };
  }
  await db.insert(clientObservations).values([
    { clientId: clientIds["Lucía Huamán"].id, body: "Pide muchas correcciones, dejar claro qué incluye.", kind: "trato", authorId: userIds.carla, alertOnNewJob: true },
    { clientId: clientIds["Bruno Salazar"].id, body: "Paga tarde: pedir el adelanto antes de empezar.", kind: "pagos", authorId: userIds.admin, alertOnNewJob: true },
    { clientId: clientIds["Lucía Huamán"].id, body: "Siempre quiere el DWG además del PDF.", kind: "archivos", authorId: userIds.ana },
  ]);

  const items = await db.select().from(serviceItems);
  const cats = await db.select().from(serviceCategories);
  const itemByCode = new Map(items.map((i) => [i.code, i]));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const factors = DEFAULT_CYCLE_FACTORS;
  const methods: PaymentMethod[] = ["yape", "plin", "transferencia", "efectivo", "yape", "yape"];

  let seq = 0;
  for (const [n, spec] of JOBS.entries()) {
    seq++;
    const client = clientIds[spec.client];
    const first = itemByCode.get(spec.items[0][0])!;
    const prefix = catById.get(first.categoryId)!.prefix;
    const factor = cycleFactor(factors, client.cycle);
    const pct = DEFAULT_URGENCY[spec.urgency ?? "normal"].pct;
    const lines = spec.items.map(([code, qty]) => {
      const it = itemByCode.get(code)!;
      return { basePrice: it.basePrice, quantity: qty, pricingMode: it.pricingMode, hours: it.hours };
    });
    const { total, hours } = computeTotal(lines, factor, pct);
    const createdAt = day(-(spec.createdDaysAgo ?? 1), "10:00");
    const dueAt = day(spec.dueInDays, spec.dueTime);
    const responsibleId = spec.who && spec.who !== "externo" ? userIds[spec.who] : null;
    const [job] = await db
      .insert(jobs)
      .values({
        code: jobCode(prefix, year, seq),
        year,
        seq,
        clientId: client.id,
        title: spec.title,
        cycle: client.cycle,
        university: client.university,
        course: spec.course,
        professor: spec.professor,
        academicTerm: academicTermFor(dueAt),
        dueAt,
        originalDueAt: dueAt,
        urgency: spec.urgency ?? "normal",
        urgencyPct: pct,
        price: total,
        estimatedHours: hours,
        status: spec.status,
        statusChangedAt: day(-Math.min(1, spec.createdDaysAgo ?? 1), "09:00"),
        responsibleId,
        externoId: spec.who === "externo" ? ext.id : null,
        takenAt: responsibleId ? day(-(spec.createdDaysAgo ?? 1) + 1, "11:00") : null,
        correctionRounds: spec.rounds ?? 0,
        finishedAt: spec.status === "finalizado" ? dueAt : null,
        finishedById: spec.status === "finalizado" ? userIds.carla : null,
        sentAt: ["en_revision", "finalizado"].includes(spec.status) ? dueAt : null,
        cancelledAt: spec.status === "cancelado" ? day(-2, "16:00") : null,
        cancelledById: spec.status === "cancelado" ? userIds.carla : null,
        cancelReason: spec.status === "cancelado" ? "No pagó el adelanto" : null,
        cancelledFromStatus: spec.status === "cancelado" ? "cotizacion" : null,
        origin: "demo",
        createdById: userIds.carla,
        createdAt,
      })
      .returning({ id: jobs.id });

    await db.insert(jobItems).values(
      spec.items.map(([code, qty, done], j) => {
        const it = itemByCode.get(code)!;
        const allDone = spec.status === "terminado" || spec.status === "en_revision" || spec.status === "finalizado";
        const isDone = allDone || !!done;
        return {
          jobId: job.id,
          serviceItemId: it.id,
          code,
          categoryCode: catById.get(it.categoryId)!.code,
          name: it.name,
          unit: it.unit,
          pricingMode: it.pricingMode,
          basePrice: it.basePrice,
          factor: it.pricingMode === "ciclo" ? factor : 1,
          quantity: qty,
          hours: (it.hours ?? 0) * qty,
          amount: lineAmount({ basePrice: it.basePrice, quantity: qty, pricingMode: it.pricingMode }, factor),
          sortOrder: j,
          doneAt: isDone ? day(-1, "15:00") : null,
          doneById: isDone ? (responsibleId ?? userIds.ana) : null,
        };
      }),
    );

    const paid = spec.paid === "all" ? total : spec.paid === "half" ? Math.round(total / 2) : (spec.paid ?? 0);
    if (paid > 0) {
      const halves = spec.paid === "all" && total > 100 ? [Math.round(total / 2), total - Math.round(total / 2)] : [paid];
      await db.insert(payments).values(
        halves.map((amount, k) => ({
          jobId: job.id,
          amount,
          method: methods[(n + k) % methods.length],
          operationNumber: String(100000 + ((n * 7919 + k * 104729) % 899999)),
          label: k === 0 ? "Adelanto" : "Pago",
          paidAt: k === 0 ? createdAt : day(Math.min(0, spec.dueInDays), k === 1 ? "12:30" : "09:10"),
          reviewedAt: n % 3 === 0 ? now : null,
          reviewedById: n % 3 === 0 ? userIds.admin : null,
          origin: "demo" as const,
          createdById: k === 0 ? userIds.carla : userIds.admin,
        })),
      );
    }
    if (spec.title === "Cortes y elevaciones biblioteca") {
      await db.insert(jobNotes).values({ jobId: job.id, body: "Dejé hechos los cortes y las elevaciones. Falta el render exterior; el modelo está en Avances.", isHandoff: true, authorId: userIds.ana });
    }
  }
  // Historia: trabajos finalizados de las últimas 12 semanas, para Estadísticas e ingresos.
  const pool = ["PL-02", "PL-06", "PL-07", "LG-06", "PA-01", "MD-03", "DOC-01", "PC-01", "MQ-02", "LA-03", "GEN-01", "TO-01"];
  const people = ["ana", "luis", "admin"] as const;
  for (let i = 0; i < 34; i++) {
    seq++;
    const c = CLIENTS[(i * 3) % CLIENTS.length];
    const client = clientIds[c.name];
    const codes = [pool[i % pool.length], pool[(i * 5 + 3) % pool.length]].slice(0, 1 + (i % 2));
    const its = codes.map((code) => itemByCode.get(code)!);
    const factor = cycleFactor(factors, client.cycle);
    const urg: Urgency = i % 7 === 0 ? "urgente" : i % 4 === 0 ? "alta" : "normal";
    const pct = DEFAULT_URGENCY[urg].pct;
    const qty = 1 + (i % 3 === 0 ? 1 : 0);
    const { total, hours } = computeTotal(
      its.map((it) => ({ basePrice: it.basePrice, quantity: qty, pricingMode: it.pricingMode, hours: it.hours })),
      factor,
      pct,
    );
    const ago = 8 + Math.round(i * 2.3);
    const dueAt = day(-ago + 4, "18:00");
    const who = userIds[people[i % people.length]];
    const [job] = await db
      .insert(jobs)
      .values({
        code: jobCode(catById.get(its[0].categoryId)!.prefix, year, seq),
        year,
        seq,
        clientId: client.id,
        title: its[0].name,
        cycle: client.cycle,
        university: client.university,
        academicTerm: academicTermFor(dueAt),
        dueAt,
        originalDueAt: dueAt,
        urgency: urg,
        urgencyPct: pct,
        price: total,
        estimatedHours: hours,
        status: "finalizado",
        statusChangedAt: dueAt,
        responsibleId: who,
        takenAt: day(-ago, "15:00"),
        finishedAt: dueAt,
        finishedById: userIds.carla,
        sentAt: dueAt,
        origin: "demo",
        createdById: userIds.carla,
        createdAt: day(-ago, "10:00"),
      })
      .returning({ id: jobs.id });
    await db.insert(jobItems).values(
      its.map((it, j) => ({
        jobId: job.id,
        serviceItemId: it.id,
        code: it.code,
        categoryCode: catById.get(it.categoryId)!.code,
        name: it.name,
        unit: it.unit,
        pricingMode: it.pricingMode,
        basePrice: it.basePrice,
        factor: it.pricingMode === "ciclo" ? factor : 1,
        quantity: qty,
        hours: (it.hours ?? 0) * qty,
        amount: lineAmount({ basePrice: it.basePrice, quantity: qty, pricingMode: it.pricingMode }, factor),
        sortOrder: j,
        doneAt: dueAt,
        doneById: who,
      })),
    );
    const half = Math.round(total / 2);
    await db.insert(payments).values(
      [half, total - half].map((amount, k) => ({
        jobId: job.id,
        amount,
        method: methods[(i + k * 2) % methods.length],
        label: k === 0 ? "Adelanto" : "Pago",
        paidAt: k === 0 ? day(-ago, "10:30") : dueAt,
        reviewedAt: now,
        reviewedById: userIds.admin,
        origin: "demo" as const,
        createdById: userIds.carla,
      })),
    );
  }
  await db.insert(jobCounters).values({ year, last: seq });
}

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}
