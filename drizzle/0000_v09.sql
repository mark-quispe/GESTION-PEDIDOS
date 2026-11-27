CREATE TYPE "public"."correction_charge" AS ENUM('incluida', 'se_cobra', 'error_estudio', 'extra');--> statement-breakpoint
CREATE TYPE "public"."job_folder" AS ENUM('recibido', 'avances', 'entrega_final', 'pagos');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('cotizacion', 'confirmado', 'en_proceso', 'terminado', 'en_revision', 'correcciones', 'finalizado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('pago', 'devolucion');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('yape', 'plin', 'transferencia', 'efectivo');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('fijo', 'ciclo');--> statement-breakpoint
CREATE TYPE "public"."record_source" AS ENUM('sistema', 'contingencia', 'importacion', 'demo');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('normal', 'alta', 'urgente');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"job_id" uuid,
	"summary" text,
	"before" jsonb,
	"after" jsonb,
	"user_id" uuid,
	"source" "record_source" DEFAULT 'sistema' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"body" text NOT NULL,
	"kind" text,
	"alert_on_new_job" boolean DEFAULT false NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"university" text,
	"career" text,
	"cycle" integer,
	"source" text,
	"software" text,
	"software_version" text,
	"usual_format" text,
	"requested_files" text,
	"other_prefs" text,
	"origin" "record_source" DEFAULT 'sistema' NOT NULL,
	"created_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "externos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"note" text,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"drive_file_id" text,
	"file_name" text NOT NULL,
	"content_hash" text NOT NULL,
	"summary" jsonb,
	"imported_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imports_contentHash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "job_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"request" text NOT NULL,
	"charge" "correction_charge" NOT NULL,
	"what_failed" text,
	"amount" numeric(12, 2),
	"previous_due_at" timestamp with time zone,
	"new_due_at" timestamp with time zone,
	"received_by_id" uuid,
	"taken_by_id" uuid,
	"externo_id" uuid,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_extras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"correction_id" uuid,
	"reason" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "job_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"payment_id" uuid,
	"folder" "job_folder" NOT NULL,
	"drive_file_id" text NOT NULL,
	"name" text NOT NULL,
	"mime_type" text,
	"size" bigint,
	"web_view_link" text,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	CONSTRAINT "job_files_driveFileId_unique" UNIQUE("drive_file_id")
);
--> statement-breakpoint
CREATE TABLE "job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"service_item_id" uuid,
	"code" text NOT NULL,
	"category_code" text NOT NULL,
	"name" text NOT NULL,
	"detail" text,
	"unit" text,
	"pricing_mode" "pricing_mode" NOT NULL,
	"base_price" numeric(12, 2) NOT NULL,
	"factor" numeric(5, 2) DEFAULT 1 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"hours" numeric(7, 2) DEFAULT 0 NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"done_at" timestamp with time zone,
	"done_by_id" uuid,
	"done_by_externo_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_handoff" boolean DEFAULT false NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_views" (
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_views_user_id_job_id_pk" PRIMARY KEY("user_id","job_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"year" integer NOT NULL,
	"seq" integer NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cycle" integer NOT NULL,
	"course" text,
	"professor" text,
	"section" text,
	"academic_term" text,
	"university" text,
	"software" text,
	"delivery_format" text,
	"due_at" timestamp with time zone NOT NULL,
	"original_due_at" timestamp with time zone,
	"urgency" "urgency" DEFAULT 'normal' NOT NULL,
	"urgency_pct" integer DEFAULT 0 NOT NULL,
	"complexity_extra" numeric(12, 2) DEFAULT 0 NOT NULL,
	"discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"price" numeric(12, 2) DEFAULT 0 NOT NULL,
	"estimated_hours" numeric(7, 2) DEFAULT 0 NOT NULL,
	"status" "job_status" DEFAULT 'cotizacion' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responsible_id" uuid,
	"externo_id" uuid,
	"taken_at" timestamp with time zone,
	"correction_rounds" integer DEFAULT 0 NOT NULL,
	"parent_job_id" uuid,
	"continues_job_id" uuid,
	"drive_folder_id" text,
	"drive_recibido_id" text,
	"drive_avances_id" text,
	"drive_entrega_final_id" text,
	"drive_pagos_id" text,
	"sent_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"finished_by_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_id" uuid,
	"cancel_reason" text,
	"cancel_note" text,
	"cancelled_from_status" "job_status",
	"origin" "record_source" DEFAULT 'sistema' NOT NULL,
	"created_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" "payment_kind" DEFAULT 'pago' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"method" "payment_method" NOT NULL,
	"operation_number" text,
	"label" text,
	"reason" text,
	"correction_id" uuid,
	"receipt_file_id" text,
	"receipt_link" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_id" uuid,
	"voided_at" timestamp with time zone,
	"voided_by_id" uuid,
	"void_reason" text,
	"origin" "record_source" DEFAULT 'sistema' NOT NULL,
	"created_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"prefix" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "service_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"includes" text,
	"unit" text NOT NULL,
	"hours" numeric(6, 2),
	"pricing_mode" "pricing_mode" DEFAULT 'ciclo' NOT NULL,
	"base_price" numeric(12, 2) NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_items_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"code_start" integer DEFAULT 1 NOT NULL,
	"studio_name" text DEFAULT 'Estudio' NOT NULL,
	"logo_url" text,
	"instagram" text,
	"tiktok" text,
	"facebook" text,
	"whatsapp" text,
	"urgency" jsonb NOT NULL,
	"cycle_factors" jsonb NOT NULL,
	"alerts" jsonb NOT NULL,
	"drive_refresh_token_enc" text,
	"drive_account_email" text,
	"drive_root_folder_id" text,
	"drive_root_folder_name" text,
	"drive_backups_folder_id" text,
	"drive_contingency_file_id" text,
	"drive_connected_at" timestamp with time zone,
	"drive_disconnected_at" timestamp with time zone,
	"last_backup_at" timestamp with time zone,
	"last_backup_ok" boolean,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"image" text,
	"roles" text[] DEFAULT '{"empleado"}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "client_observations" ADD CONSTRAINT "client_observations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_corrections" ADD CONSTRAINT "job_corrections_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_extras" ADD CONSTRAINT "job_extras_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_files" ADD CONSTRAINT "job_files_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_items" ADD CONSTRAINT "job_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_notes" ADD CONSTRAINT "job_notes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_job_idx" ON "audit_log" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "client_obs_client_idx" ON "client_observations" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_whatsapp_unique" ON "clients" USING btree ("whatsapp");--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "job_corrections_job_idx" ON "job_corrections" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_extras_job_idx" ON "job_extras" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_files_job_idx" ON "job_files" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_items_job_idx" ON "job_items" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_notes_job_idx" ON "job_notes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_views_user_idx" ON "job_views" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_year_seq_unique" ON "jobs" USING btree ("year","seq");--> statement-breakpoint
CREATE INDEX "jobs_client_idx" ON "jobs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "jobs" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "jobs_parent_idx" ON "jobs" USING btree ("parent_job_id");--> statement-breakpoint
CREATE INDEX "payments_job_idx" ON "payments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "service_items_category_idx" ON "service_items" USING btree ("category_id");