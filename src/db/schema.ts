/**
 * Modelo de datos según docs/requerimientos.md (v0.9).
 * Regla general (RF-29): nada se borra de verdad. Clientes, trabajos y pagos
 * llevan `deletedAt` y se ocultan; el admin los restaura desde "Eliminados".
 * Los montos se guardan como numeric(12,2) y se leen como number.
 */
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ---------- Enums ---------- */

/** 2: los roles se combinan. Admin ya incluye todo. */
export const ROLES = ["admin", "empleado", "produccion"] as const;
export type Role = (typeof ROLES)[number];

/** RF-09 y RF-58: flujo de estados. Cancelado es posible desde cualquiera. */
export const jobStatusEnum = pgEnum("job_status", [
  "cotizacion",
  "confirmado",
  "en_proceso",
  "terminado",
  "en_revision",
  "correcciones",
  "finalizado",
  "cancelado",
]);
export type JobStatus = (typeof jobStatusEnum.enumValues)[number];

export const urgencyEnum = pgEnum("urgency", ["normal", "alta", "urgente"]);
export type Urgency = (typeof urgencyEnum.enumValues)[number];

/** RF-14 */
export const paymentMethodEnum = pgEnum("payment_method", ["yape", "plin", "transferencia", "efectivo"]);
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];

/** RF-42: una devolución es un movimiento aparte en negativo. */
export const paymentKindEnum = pgEnum("payment_kind", ["pago", "devolucion"]);
export type PaymentKind = (typeof paymentKindEnum.enumValues)[number];

/** RF-23 y RF-43: subcarpetas de cada trabajo en Drive. */
export const jobFolderEnum = pgEnum("job_folder", ["recibido", "avances", "entrega_final", "pagos"]);
export type JobFolder = (typeof jobFolderEnum.enumValues)[number];

/** RF-59: FIJO o ×C (se multiplica por el factor del ciclo). */
export const pricingModeEnum = pgEnum("pricing_mode", ["fijo", "ciclo"]);
export type PricingMode = (typeof pricingModeEnum.enumValues)[number];

/** RF-65: cómo se resuelve una corrección. */
export const correctionChargeEnum = pgEnum("correction_charge", ["incluida", "se_cobra", "error_estudio", "extra"]);
export type CorrectionCharge = (typeof correctionChargeEnum.enumValues)[number];

/** De dónde vino un registro (RF-34 marca lo que llegó de la contingencia). */
export const recordSourceEnum = pgEnum("record_source", ["sistema", "contingencia", "importacion", "demo"]);
export type RecordSource = (typeof recordSourceEnum.enumValues)[number];

const money = (name?: string) =>
  name ? numeric(name, { precision: 12, scale: 2, mode: "number" }) : numeric({ precision: 12, scale: 2, mode: "number" });

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const softDelete = {
  deletedAt: timestamp({ withTimezone: true }),
  deletedById: uuid(),
};

/* ---------- Acceso (RF-01 a RF-04, RNF-13) ---------- */

/**
 * Personas del estudio con cuenta. El admin las crea con su Gmail; solo esos
 * correos pueden entrar (RF-02). `active = false` quita el acceso al instante.
 */
export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  name: text().notNull(),
  phone: text(),
  image: text(),
  /** admin | empleado | produccion (uno o varios). */
  roles: text().array().notNull().default(["empleado"]),
  active: boolean().notNull().default(true),
  lastLoginAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

/** RF-18: externos, sin acceso a la app. Solo aparecen como responsables. */
export const externos = pgTable("externos", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  phone: text(),
  note: text(),
  /** Códigos de ítems del tarifario que suele hacer (sugerencia al encargar). */
  skills: text().array().notNull().default([]),
  active: boolean().notNull().default(true),
  createdById: uuid(),
  ...timestamps,
});

/* ---------- Configuración (una sola fila, id = 1) ---------- */

export type UrgencyConfig = Record<Urgency, { hours: number; pct: number }>;
export type CycleFactors = Record<string, number>;
export type AlertsConfig = { quoteDays: number; pendingDays: number; driveFullPct: number; backupFailed: boolean };

export const settings = pgTable("settings", {
  id: integer().primaryKey().default(1),
  /** RF-08: número con el que empieza el correlativo cada año (1 o 100). */
  codeStart: integer().notNull().default(1),
  studioName: text().notNull().default("Estudio"),
  logoUrl: text(),
  /** RF-55 */
  instagram: text(),
  tiktok: text(),
  facebook: text(),
  whatsapp: text(),
  /** RF-57: plazo en horas y recargo en %. Normal siempre 0 %. */
  urgency: jsonb().$type<UrgencyConfig>().notNull(),
  /** RF-08: factor por ciclo de la carrera (1–10). */
  cycleFactors: jsonb().$type<CycleFactors>().notNull(),
  /** RF-56 */
  alerts: jsonb().$type<AlertsConfig>().notNull(),
  /** RF-22: refresh token de Drive, cifrado con AES-256-GCM (src/lib/crypto.ts). */
  driveRefreshTokenEnc: text(),
  driveAccountEmail: text(),
  driveRootFolderId: text(),
  driveRootFolderName: text(),
  driveBackupsFolderId: text(),
  driveContingencyFileId: text(),
  driveConnectedAt: timestamp({ withTimezone: true }),
  /** RF-30: se marca cuando Google rechaza la llave. */
  driveDisconnectedAt: timestamp({ withTimezone: true }),
  lastBackupAt: timestamp({ withTimezone: true }),
  lastBackupOk: boolean(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ---------- Servicios = tarifario (RF-08, RF-59, RF-68) ---------- */

export const serviceCategories = pgTable("service_categories", {
  id: uuid().primaryKey().defaultRandom(),
  /** Código de la categoría: PC, LA, PL… (VAL comparte categoría con PC). */
  code: text().notNull().unique(),
  /** Prefijo de dos letras para el código del trabajo (RF-08). */
  prefix: text().notNull(),
  name: text().notNull(),
  sortOrder: integer().notNull().default(0),
  /** OT · Personalizado: siempre al final. */
  isCustom: boolean().notNull().default(false),
  ...timestamps,
});

export const serviceItems = pgTable(
  "service_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    categoryId: uuid()
      .notNull()
      .references(() => serviceCategories.id),
    /** PL-06 */
    code: text().notNull().unique(),
    name: text().notNull(),
    includes: text(),
    /** "por nivel", "por corte"… */
    unit: text().notNull(),
    hours: numeric({ precision: 6, scale: 2, mode: "number" }),
    pricingMode: pricingModeEnum().notNull().default("ciclo"),
    basePrice: money().notNull(),
    /** ★ precio definido por el estudio (sin estrella = referencial). */
    starred: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [index("service_items_category_idx").on(t.categoryId)],
);

/* ---------- Clientes (RF-05 a RF-07, RF-36, RF-38, RF-45) ---------- */

export const clients = pgTable(
  "clients",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    /** Solo dígitos, sin código de país (987654321). RF-36: único. */
    whatsapp: text().notNull(),
    university: text(),
    career: text(),
    /** Ciclo que cursa (1–10). */
    cycle: integer(),
    /** Cómo llegó: recomendación, Instagram, Facebook… */
    source: text(),
    /* RF-38: preferencias que se copian al crear un trabajo nuevo. */
    software: text(),
    softwareVersion: text(),
    usualFormat: text(),
    requestedFiles: text(),
    otherPrefs: text(),
    origin: recordSourceEnum().notNull().default("sistema"),
    createdById: uuid(),
    ...softDelete,
    ...timestamps,
  },
  (t) => [uniqueIndex("clients_whatsapp_unique").on(t.whatsapp), index("clients_name_idx").on(t.name)],
);

/** RF-45: observaciones cortas, una por casilla. */
export const clientObservations = pgTable(
  "client_observations",
  {
    id: uuid().primaryKey().defaultRandom(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    body: text().notNull(),
    /** pagos | trato | entregas | archivos | otro */
    kind: text(),
    alertOnNewJob: boolean().notNull().default(false),
    authorId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("client_obs_client_idx").on(t.clientId)],
);

/* ---------- Trabajos (RF-08 a RF-13, RF-35 a RF-41, RF-57 a RF-68) ---------- */

/** RF-08: correlativo único por año, compartido por todos los tipos. */
export const jobCounters = pgTable("job_counters", {
  year: integer().primaryKey(),
  last: integer().notNull(),
});

export const jobs = pgTable(
  "jobs",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Etiqueta visible (PL26-014). No cambia después de creada. */
    code: text().notNull().unique(),
    year: integer().notNull(),
    seq: integer().notNull(),
    clientId: uuid()
      .notNull()
      .references(() => clients.id),
    /** Descripción corta de lo que pide. */
    title: text().notNull(),
    description: text(),
    /** RF-60: ciclo de la carrera (1–10), obligatorio. */
    cycle: integer().notNull(),
    course: text(),
    professor: text(),
    section: text(),
    /** Ciclo académico, por ejemplo 2026-II (se deduce de la fecha). */
    academicTerm: text(),
    university: text(),
    /* RF-38: preferencias copiadas del cliente al crear el trabajo. */
    software: text(),
    deliveryFormat: text(),
    /** Fecha y hora de entrega vigente (RF-13 mide el atraso contra esta). */
    dueAt: timestamp({ withTimezone: true }).notNull(),
    /** Fecha pactada al registrar (antes de cualquier corrección). */
    originalDueAt: timestamp({ withTimezone: true }),
    urgency: urgencyEnum().notNull().default("normal"),
    /** RF-57: el recargo se guarda al crear; cambiar los % después no lo altera. */
    urgencyPct: integer().notNull().default(0),
    /** RF-59: adicional por complejidad en soles. */
    complexityExtra: money().notNull().default(0),
    discount: money().notNull().default(0),
    /** Precio pactado (Σ ítems × recargo + adicional − descuento). Extras van aparte (RF-66). */
    price: money().notNull().default(0),
    estimatedHours: numeric({ precision: 7, scale: 2, mode: "number" }).notNull().default(0),
    status: jobStatusEnum().notNull().default("cotizacion"),
    statusChangedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** RF-47: quien lo tomó (rol Producción o admin). Nunca lo pone otra persona. */
    responsibleId: uuid(),
    /** RF-47: externo al que se le encargó (lo puede hacer cualquier rol). */
    externoId: uuid(),
    takenAt: timestamp({ withTimezone: true }),
    /** RF-65: rondas de corrección usadas (2 incluidas). */
    correctionRounds: integer().notNull().default(0),
    /** RF-39: siempre apunta al trabajo original, nunca a otro relacionado. */
    parentJobId: uuid(),
    /** RF-64 y RF-63: continúa / retoma otro trabajo. */
    continuesJobId: uuid(),
    /* RF-23: IDs de Drive. Se usan los IDs, no los nombres. */
    driveFolderId: text(),
    driveRecibidoId: text(),
    driveAvancesId: text(),
    driveEntregaFinalId: text(),
    drivePagosId: text(),
    sentAt: timestamp({ withTimezone: true }),
    finishedAt: timestamp({ withTimezone: true }),
    finishedById: uuid(),
    /* RF-63: anulación. */
    cancelledAt: timestamp({ withTimezone: true }),
    cancelledById: uuid(),
    cancelReason: text(),
    cancelNote: text(),
    /** Estado al anular, para reabrir desde el mismo paso. */
    cancelledFromStatus: jobStatusEnum(),
    origin: recordSourceEnum().notNull().default("sistema"),
    createdById: uuid(),
    ...softDelete,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("jobs_year_seq_unique").on(t.year, t.seq),
    index("jobs_client_idx").on(t.clientId),
    index("jobs_status_idx").on(t.status),
    index("jobs_due_idx").on(t.dueAt),
    index("jobs_parent_idx").on(t.parentJobId),
  ],
);

/** RF-59 y RF-61: lo que se cobra, con precios congelados al registrar. */
export const jobItems = pgTable(
  "job_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    serviceItemId: uuid(),
    /** PL-06 (OT-01 para personalizado). */
    code: text().notNull(),
    categoryCode: text().notNull(),
    name: text().notNull(),
    /** RF-68: qué es, con todo el detalle. */
    detail: text(),
    unit: text(),
    pricingMode: pricingModeEnum().notNull(),
    basePrice: money().notNull(),
    /** Factor de ciclo aplicado (1 si es FIJO). */
    factor: numeric({ precision: 5, scale: 2, mode: "number" }).notNull().default(1),
    quantity: integer().notNull().default(1),
    hours: numeric({ precision: 7, scale: 2, mode: "number" }).notNull().default(0),
    /** base × cantidad × factor (sin recargo). */
    amount: money().notNull(),
    sortOrder: integer().notNull().default(0),
    /* RF-61: avance por ítem. */
    doneAt: timestamp({ withTimezone: true }),
    doneById: uuid(),
    doneByExternoId: uuid(),
    ...timestamps,
  },
  (t) => [index("job_items_job_idx").on(t.jobId)],
);

/** RF-65: cada ronda de corrección. */
export const jobCorrections = pgTable(
  "job_corrections",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    /** Número de pedido de corrección (1, 2, 3…). */
    number: integer().notNull(),
    request: text().notNull(),
    charge: correctionChargeEnum().notNull(),
    whatFailed: text(),
    amount: money(),
    previousDueAt: timestamp({ withTimezone: true }),
    newDueAt: timestamp({ withTimezone: true }),
    receivedById: uuid(),
    /** Quién la hace: usuario o externo (vacío = por tomar). */
    takenById: uuid(),
    externoId: uuid(),
    doneAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_corrections_job_idx").on(t.jobId)],
);

/** RF-66: extras aparte del precio pactado. */
export const jobExtras = pgTable(
  "job_extras",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    correctionId: uuid(),
    reason: text().notNull(),
    amount: money().notNull(),
    createdById: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...softDelete,
  },
  (t) => [index("job_extras_job_idx").on(t.jobId)],
);

/** RF-44 y RF-67: apuntes de quienes toman el trabajo. Solo se agregan. */
export const jobNotes = pgTable(
  "job_notes",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    body: text().notNull(),
    /** La nota que deja quien soltó el trabajo. */
    isHandoff: boolean().notNull().default(false),
    authorId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_notes_job_idx").on(t.jobId)],
);

/** Última vez que alguien abrió una ficha: «Seguir donde te quedaste» y notas sin leer. */
export const jobViews = pgTable(
  "job_views",
  {
    userId: uuid().notNull(),
    jobId: uuid().notNull(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.jobId] }), index("job_views_user_idx").on(t.userId, t.lastSeenAt)],
);

/* ---------- Pagos (RF-14 a RF-17, RF-42, RF-43, RF-63) ---------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    kind: paymentKindEnum().notNull().default("pago"),
    /** Siempre positivo. Una devolución resta. */
    amount: money().notNull(),
    paidAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    method: paymentMethodEnum().notNull(),
    operationNumber: text(),
    /** adelanto | pago | extra · corrección N | devolución… */
    label: text(),
    /** Motivo de la devolución (RF-42) o nota. */
    reason: text(),
    correctionId: uuid(),
    receiptFileId: text(),
    receiptLink: text(),
    /** RF-15: el admin lo compara con su app de Yape o del banco. */
    reviewedAt: timestamp({ withTimezone: true }),
    reviewedById: uuid(),
    /** RF-16: anulado por el admin, no se borra. */
    voidedAt: timestamp({ withTimezone: true }),
    voidedById: uuid(),
    voidReason: text(),
    origin: recordSourceEnum().notNull().default("sistema"),
    createdById: uuid(),
    ...softDelete,
    ...timestamps,
  },
  (t) => [index("payments_job_idx").on(t.jobId), index("payments_paid_at_idx").on(t.paidAt)],
);

/* ---------- Archivos en Drive (RF-24, RF-25, RNF-05) ---------- */

export const jobFiles = pgTable(
  "job_files",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    paymentId: uuid(),
    folder: jobFolderEnum().notNull(),
    driveFileId: text().notNull().unique(),
    name: text().notNull(),
    mimeType: text(),
    size: bigint({ mode: "number" }),
    webViewLink: text(),
    uploadedById: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...softDelete,
  },
  (t) => [index("job_files_job_idx").on(t.jobId)],
);

/* ---------- Historial (RF-21, RNF-24) ---------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** cliente | trabajo | item | pago | archivo | usuario | externo | servicio | configuracion | sesion */
    entity: text().notNull(),
    entityId: text().notNull(),
    /** crear | editar | estado | precio | tomar | soltar | item | eliminar | restaurar | … */
    action: text().notNull(),
    /** Trabajo al que pertenece el cambio (para verlo en su ficha). */
    jobId: uuid(),
    summary: text(),
    before: jsonb(),
    after: jsonb(),
    userId: uuid(),
    source: recordSourceEnum().notNull().default("sistema"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_job_idx").on(t.jobId), index("audit_created_idx").on(t.createdAt)],
);

/* ---------- Importaciones (RF-28, RF-34) ---------- */

export const imports = pgTable("imports", {
  id: uuid().primaryKey().defaultRandom(),
  kind: text().notNull(), // planilla | contingencia
  driveFileId: text(),
  fileName: text().notNull(),
  /** Huella del contenido: RF-34 rechaza un archivo ya importado. */
  contentHash: text().notNull().unique(),
  summary: jsonb(),
  importedById: uuid(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Relaciones ---------- */

export const usersRelations = relations(users, () => ({}));

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({ items: many(serviceItems) }));
export const serviceItemsRelations = relations(serviceItems, ({ one }) => ({
  category: one(serviceCategories, { fields: [serviceItems.categoryId], references: [serviceCategories.id] }),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  jobs: many(jobs),
  observations: many(clientObservations),
}));

export const clientObservationsRelations = relations(clientObservations, ({ one }) => ({
  client: one(clients, { fields: [clientObservations.clientId], references: [clients.id] }),
  author: one(users, { fields: [clientObservations.authorId], references: [users.id] }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
  responsible: one(users, { fields: [jobs.responsibleId], references: [users.id], relationName: "responsible" }),
  externo: one(externos, { fields: [jobs.externoId], references: [externos.id] }),
  createdBy: one(users, { fields: [jobs.createdById], references: [users.id], relationName: "createdBy" }),
  finishedBy: one(users, { fields: [jobs.finishedById], references: [users.id], relationName: "finishedBy" }),
  cancelledBy: one(users, { fields: [jobs.cancelledById], references: [users.id], relationName: "cancelledBy" }),
  parent: one(jobs, { fields: [jobs.parentJobId], references: [jobs.id], relationName: "related" }),
  children: many(jobs, { relationName: "related" }),
  continues: one(jobs, { fields: [jobs.continuesJobId], references: [jobs.id], relationName: "continues" }),
  continuedBy: many(jobs, { relationName: "continues" }),
  items: many(jobItems),
  corrections: many(jobCorrections),
  extras: many(jobExtras),
  payments: many(payments),
  notes: many(jobNotes),
  files: many(jobFiles),
}));

export const jobItemsRelations = relations(jobItems, ({ one }) => ({
  job: one(jobs, { fields: [jobItems.jobId], references: [jobs.id] }),
  doneBy: one(users, { fields: [jobItems.doneById], references: [users.id] }),
  doneByExterno: one(externos, { fields: [jobItems.doneByExternoId], references: [externos.id] }),
}));

export const jobCorrectionsRelations = relations(jobCorrections, ({ one }) => ({
  job: one(jobs, { fields: [jobCorrections.jobId], references: [jobs.id] }),
  receivedBy: one(users, { fields: [jobCorrections.receivedById], references: [users.id], relationName: "corrReceived" }),
  takenBy: one(users, { fields: [jobCorrections.takenById], references: [users.id], relationName: "corrTaken" }),
  externo: one(externos, { fields: [jobCorrections.externoId], references: [externos.id] }),
}));

export const jobExtrasRelations = relations(jobExtras, ({ one }) => ({
  job: one(jobs, { fields: [jobExtras.jobId], references: [jobs.id] }),
  createdBy: one(users, { fields: [jobExtras.createdById], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  job: one(jobs, { fields: [payments.jobId], references: [jobs.id] }),
  createdBy: one(users, { fields: [payments.createdById], references: [users.id], relationName: "payCreated" }),
  voidedBy: one(users, { fields: [payments.voidedById], references: [users.id], relationName: "payVoided" }),
  reviewedBy: one(users, { fields: [payments.reviewedById], references: [users.id], relationName: "payReviewed" }),
}));

export const jobNotesRelations = relations(jobNotes, ({ one }) => ({
  job: one(jobs, { fields: [jobNotes.jobId], references: [jobs.id] }),
  author: one(users, { fields: [jobNotes.authorId], references: [users.id] }),
}));

export const jobFilesRelations = relations(jobFiles, ({ one }) => ({
  job: one(jobs, { fields: [jobFiles.jobId], references: [jobs.id] }),
  uploadedBy: one(users, { fields: [jobFiles.uploadedById], references: [users.id] }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}));
