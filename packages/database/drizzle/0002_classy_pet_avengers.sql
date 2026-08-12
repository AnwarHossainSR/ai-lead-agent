CREATE TYPE "public"."discovery_run_outcome" AS ENUM('running', 'succeeded', 'partial', 'limit_reached', 'failed');--> statement-breakpoint
CREATE TYPE "public"."discovery_source_outcome" AS ENUM('succeeded', 'skipped', 'blocked', 'failed');--> statement-breakpoint
CREATE TABLE "company_discovery_sources" (
	"company_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_discovery_sources_company_id_source_id_pk" PRIMARY KEY("company_id","source_id"),
	CONSTRAINT "company_discovery_sources_source_url_not_blank" CHECK (length(trim("company_discovery_sources"."source_url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "discovery_run_sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"outcome" "discovery_source_outcome" NOT NULL,
	"returned_count" integer DEFAULT 0 NOT NULL,
	"stored_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"rejections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	CONSTRAINT "discovery_run_sources_returned_non_negative" CHECK ("discovery_run_sources"."returned_count" >= 0),
	CONSTRAINT "discovery_run_sources_stored_non_negative" CHECK ("discovery_run_sources"."stored_count" >= 0),
	CONSTRAINT "discovery_run_sources_duplicate_non_negative" CHECK ("discovery_run_sources"."duplicate_count" >= 0),
	CONSTRAINT "discovery_run_sources_rejected_non_negative" CHECK ("discovery_run_sources"."rejected_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "discovery_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"country_id" text NOT NULL,
	"city_id" text,
	"industry_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" "discovery_run_outcome" NOT NULL,
	"candidate_limit" integer NOT NULL,
	"duration_limit_seconds" integer NOT NULL,
	"failure_reason" text,
	CONSTRAINT "discovery_runs_finished_at_after_started_at" CHECK ("discovery_runs"."finished_at" IS NULL OR "discovery_runs"."finished_at" >= "discovery_runs"."started_at"),
	CONSTRAINT "discovery_runs_candidate_limit_positive" CHECK ("discovery_runs"."candidate_limit" >= 1),
	CONSTRAINT "discovery_runs_duration_limit_positive" CHECK ("discovery_runs"."duration_limit_seconds" >= 1)
);
--> statement-breakpoint
ALTER TABLE "company_discovery_sources" ADD CONSTRAINT "company_discovery_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_run_sources" ADD CONSTRAINT "discovery_run_sources_run_id_discovery_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."discovery_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_run_sources_run_source_key" ON "discovery_run_sources" USING btree ("run_id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_runs_one_running_per_territory" ON "discovery_runs" USING btree ("country_id","industry_id") WHERE "discovery_runs"."outcome" = 'running';--> statement-breakpoint
CREATE INDEX "discovery_runs_started_at_idx" ON "discovery_runs" USING btree ("started_at");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_discovery_run_id_discovery_runs_id_fk" FOREIGN KEY ("discovery_run_id") REFERENCES "public"."discovery_runs"("id") ON DELETE set null ON UPDATE no action;