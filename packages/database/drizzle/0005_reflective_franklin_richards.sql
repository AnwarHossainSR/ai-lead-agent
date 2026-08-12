CREATE TYPE "public"."contact_extraction_method" AS ENUM('deterministic', 'model_interpretation', 'manual_entry');--> statement-breakpoint
CREATE TYPE "public"."contact_research_outcome" AS ENUM('contacts_found', 'none_found', 'blocked', 'skipped', 'failed');--> statement-breakpoint
CREATE TYPE "public"."mail_deliverability" AS ENUM('receivable', 'not_receivable', 'unknown');--> statement-breakpoint
CREATE TABLE "contact_research_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"fetched_pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skipped_pages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outcome" "contact_research_outcome" NOT NULL,
	"found_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"rejection_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "extraction_method" "contact_extraction_method" NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "seniority_id" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "role_source_url" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "mail_deliverability" "mail_deliverability";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "ai_invocation_id" uuid;--> statement-breakpoint
ALTER TABLE "contact_research_runs" ADD CONSTRAINT "contact_research_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_research_runs_company_id_idx" ON "contact_research_runs" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_ai_invocation_id_ai_invocations_id_fk" FOREIGN KEY ("ai_invocation_id") REFERENCES "public"."ai_invocations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_interpreted_requires_invocation" CHECK (("contacts"."extraction_method" != 'model_interpretation') OR "contacts"."ai_invocation_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_seniority_requires_title" CHECK ("contacts"."seniority_id" IS NULL OR "contacts"."job_title" IS NOT NULL);