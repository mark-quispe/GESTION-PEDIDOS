ALTER TABLE "settings" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "academic_term" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "backup_enabled" boolean DEFAULT true NOT NULL;