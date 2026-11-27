/**
 * Modelo de datos según docs/requerimientos.md (v0.5).
 * Regla general (RF-29): nada se borra de verdad. Clientes, trabajos y pagos
 * llevan `deletedAt` y se ocultan; el admin los restaura desde "Eliminados".
 */
import {
  bigint,
  boolean,
  date,
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

export const roleEnum = pgEnum("role", ["admin", "empleado"]);
export type Role = (typeof roleEnum.enumValues)[number];

/** RF-09: flujo de estados del trabajo. Cancelado es posible desde cualquiera. */
export const jobStatusEnum = pgEnum("job_status", [
  "consulta",
  "cotizado",
  "confirmado",
  "en_proceso",
  "en_revision",
  "correcciones",
  "entregado",
  "cancelado",
]);
export type JobStatus = (typeof jobStatusEnum.enumValues)[number];

export const urgencyEnum = pgEnum("urgency", ["normal", "alta", "urgente"]);
export type Urgency = (typeof urgencyEnum.enumValues)[number];

/** RF-14: medios de pago. */
export const paymentMethodEnum = pgEnum("payment_method", ["yape", "plin", "transferencia", "efectivo"]);
export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];

/** RF-42: una devolución se descuenta de lo pagado. */
export const paymentKindEnum = pgEnum("payment_kind", ["pago", "devolucion"]);
export type PaymentKind = (typeof paymentKindEnum.enumValues)[number];

/** RF-23 y RF-43: subcarpetas de cada trabajo en Drive. */
export const jobFolderEnum = pgEnum("job_folder", ["recibido", "avances", "entrega_final", "pagos"]);
export type JobFolder = (typeof jobFolderEnum.enumValues)[number];

/** De dónde vino un registro (RF-34 marca lo que llegó de la contingencia). */
export const recordSourceEnum = pgEnum("record_source", ["sistema", "contingencia", "importacion"]);
export type RecordSource = (typeof recordSourceEnum.enumValues)[number];

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const softDelete = {
  deletedAt: timestamp({ withTimezone: true }),
  deletedById: text(),
};

/* ---------- Acceso (RF-01 a RF-04) ---------- */

/** Solo los correos de esta lista pueden iniciar sesión. El rol se copia al usuario al entrar. */
export const allowedEmails = pgTable("allowed_emails", {
  email: text().primaryKey(),
  role: roleEnum().notNull().default("empleado"),
  addedBy: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/* Tablas de Auth.js (formato del Drizzle adapter). `user` es la tabla de usuarios con su rol. */

export const users = pgTable("user", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text(),
  email: text().unique(),
  emailVerified: timestamp({ mode: "date" }),
  image: text(),
  role: roleEnum().notNull().default("empleado"),
  active: integer().notNull().default(1),
});

export const accounts = pgTable(
  "account",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text().primaryKey(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp({ mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ---------- Configuración (una sola fila, id = 1) ---------- */

export const settings = pgTable("settings", {
  id: integer().primaryKey().default(1),
  /** RF-08: número con el que empieza el correlativo cada año (1 o 100). */
  codeStart: integer().notNull().default(1),
  /** RF-22: refresh token de Drive, cifrado con AES-256-GCM (src/lib/crypto.ts). */
  driveRefreshTokenEnc: text(),
  driveAccountEmail: text(),
  driveRootFolderId: text(),
  driveRootFolderName: text(),
  driveBackupsFolderId: text(),
  driveContingencyFileId: text(),
  driveConnectedAt: timestamp({ withTimezone: true }),
  /** RF-30: se marca cuando Google rechaza la llave (permiso quitado, credenciales cambiadas). */
  driveDisconnectedAt: timestamp({ withTimezone: true }),
  lastBackupAt: timestamp({ withTimezone: true }),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/* ---------- Catálogos que mantiene el admin ---------- */

/** RF-08: tipos de servicio con su prefijo de dos letras. */
export const serviceTypes = pgTable("service_types", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  prefix: text().notNull().unique(),
  active: boolean().notNull().default(true),
  ...timestamps,
});

/** RF-18: responsables. No tienen cuenta, son solo nombres. */
export const responsables = pgTable("responsables", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  contact: text(),
  active: boolean().notNull().default(true),
  ...timestamps,
});

/* ---------- Clientes (RF-05 a RF-07, RF-36, RF-38, RF-45) ---------- */

export const clients = pgTable(
  "clients",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    /** Solo dígitos, con código de país (51…). RF-36: único. */
    whatsapp: text().notNull(),
    university: text(),
    career: text(),
    /** Ciclo que cursa el estudiante (por ejemplo "7"). */
    cycle: text(),
    /** Cómo llegó: recomendación, Instagram, Facebook… */
    source: text(),
    /* RF-38: preferencias que se copian al crear un trabajo nuevo. */
    software: text(),
    softwareVersion: text(),
    usualFormat: text(),
    preferredResponsableId: uuid().references(() => responsables.id, { onDelete: "set null" }),
    /** RF-45: observaciones visibles para los dos roles. */
    observations: text(),
    origin: recordSourceEnum().notNull().default("sistema"),
    createdById: text().references(() => users.id, { onDelete: "set null" }),
    ...softDelete,
    ...timestamps,
  },
  (t) => [uniqueIndex("clients_whatsapp_unique").on(t.whatsapp), index("clients_name_idx").on(t.name)],
);

/* ---------- Trabajos (RF-08 a RF-13, RF-35 a RF-41, RF-44) ---------- */

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
    serviceTypeId: uuid()
      .notNull()
      .references(() => serviceTypes.id),
    course: text(),
    professor: text(),
    section: text(),
    /** Ciclo académico del curso, por ejemplo 2026-II. */
    academicTerm: text(),
    description: text().notNull(),
    /** Día en que el cliente quiere recibir el trabajo (fecha de Perú). */
    dueDate: date({ mode: "string" }),
    urgency: urgencyEnum().notNull().default("normal"),
    /** Sin precio mientras está en consulta. */
    price: numeric({ precision: 12, scale: 2 }),
    responsableId: uuid().references(() => responsables.id, { onDelete: "set null" }),
    status: jobStatusEnum().notNull().default("consulta"),
    /** RF-10 */
    correctionsCount: integer().notNull().default(0),
    /** RF-39: siempre apunta al trabajo original, nunca a otro relacionado. */
    parentJobId: uuid(),
    /* RF-23: IDs de Drive. Se usan los IDs, no los nombres. */
    driveFolderId: text(),
    driveRecibidoId: text(),
    driveAvancesId: text(),
    driveEntregaFinalId: text(),
    drivePagosId: text(),
    deliveredAt: timestamp({ withTimezone: true }),
    origin: recordSourceEnum().notNull().default("sistema"),
    createdById: text().references(() => users.id, { onDelete: "set null" }),
    ...softDelete,
    ...timestamps,
  },
  (t) => [
    uniqueIndex("jobs_year_seq_unique").on(t.year, t.seq),
    index("jobs_client_idx").on(t.clientId),
    index("jobs_status_idx").on(t.status),
    index("jobs_due_idx").on(t.dueDate),
    index("jobs_parent_idx").on(t.parentJobId),
  ],
);

/** RF-44: bitácora de notas internas. Solo se agregan. */
export const jobNotes = pgTable("job_notes", {
  id: uuid().primaryKey().defaultRandom(),
  jobId: uuid()
    .notNull()
    .references(() => jobs.id),
  body: text().notNull(),
  authorId: text().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Pagos (RF-14 a RF-17, RF-42, RF-43) ---------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    kind: paymentKindEnum().notNull().default("pago"),
    /** Siempre positivo. Una devolución resta. */
    amount: numeric({ precision: 12, scale: 2 }).notNull(),
    paidOn: date({ mode: "string" }).notNull(),
    method: paymentMethodEnum().notNull(),
    operationNumber: text(),
    /** Motivo de la devolución (RF-42). */
    reason: text(),
    receiptFileId: text(),
    receiptLink: text(),
    origin: recordSourceEnum().notNull().default("sistema"),
    createdById: text().references(() => users.id, { onDelete: "set null" }),
    ...softDelete,
    ...timestamps,
  },
  (t) => [index("payments_job_idx").on(t.jobId), index("payments_paid_on_idx").on(t.paidOn)],
);

/* ---------- Archivos en Drive (RF-24, RF-25, RNF-05) ---------- */

export const jobFiles = pgTable(
  "job_files",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => jobs.id),
    paymentId: uuid().references(() => payments.id),
    folder: jobFolderEnum().notNull(),
    driveFileId: text().notNull().unique(),
    name: text().notNull(),
    mimeType: text(),
    size: bigint({ mode: "number" }),
    webViewLink: text(),
    uploadedById: text().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...softDelete,
  },
  (t) => [index("job_files_job_idx").on(t.jobId)],
);

/* ---------- Historial (RF-21) ---------- */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** cliente | trabajo | pago | archivo | usuario | responsable | servicio | configuracion */
    entity: text().notNull(),
    entityId: text().notNull(),
    /** crear | editar | estado | precio | eliminar | restaurar | corregir | devolucion | … */
    action: text().notNull(),
    /** Trabajo al que pertenece el cambio (para verlo en su ficha). */
    jobId: uuid(),
    before: jsonb(),
    after: jsonb(),
    userId: text().references(() => users.id, { onDelete: "set null" }),
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
  importedById: text().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Relaciones ---------- */

export const clientsRelations = relations(clients, ({ one, many }) => ({
  preferredResponsable: one(responsables, { fields: [clients.preferredResponsableId], references: [responsables.id] }),
  jobs: many(jobs),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  client: one(clients, { fields: [jobs.clientId], references: [clients.id] }),
  serviceType: one(serviceTypes, { fields: [jobs.serviceTypeId], references: [serviceTypes.id] }),
  responsable: one(responsables, { fields: [jobs.responsableId], references: [responsables.id] }),
  parent: one(jobs, { fields: [jobs.parentJobId], references: [jobs.id], relationName: "related" }),
  children: many(jobs, { relationName: "related" }),
  createdBy: one(users, { fields: [jobs.createdById], references: [users.id] }),
  payments: many(payments),
  notes: many(jobNotes),
  files: many(jobFiles),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  job: one(jobs, { fields: [payments.jobId], references: [jobs.id] }),
  createdBy: one(users, { fields: [payments.createdById], references: [users.id] }),
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
