CREATE TYPE "public"."opportunity_analysis_outcome" AS ENUM('opportunities', 'insufficient_evidence', 'below_threshold', 'failed');--> statement-breakpoint
CREATE TABLE "opportunity_analysis_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"website_analysis_id" uuid,
	"prompt_version" integer NOT NULL,
	"outcome" "opportunity_analysis_outcome" NOT NULL,
	"accepted_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"rejections" jsonb DEFAULT '[]' NOT NULL,
	"ai_invocation_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "opportunity_analysis_runs" ADD CONSTRAINT "opportunity_analysis_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_analysis_runs" ADD CONSTRAINT "opportunity_analysis_runs_website_analysis_id_website_analysis_id_fk" FOREIGN KEY ("website_analysis_id") REFERENCES "public"."website_analysis"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_analysis_runs" ADD CONSTRAINT "opportunity_analysis_runs_ai_invocation_id_ai_invocations_id_fk" FOREIGN KEY ("ai_invocation_id") REFERENCES "public"."ai_invocations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_analysis_runs" ADD CONSTRAINT "opportunity_analysis_runs_outcome_check" CHECK (outcome IN ('opportunities', 'insufficient_evidence', 'below_threshold', 'failed'));--> statement-breakpoint
ALTER TABLE "opportunity_analysis_runs" ADD CONSTRAINT "opportunity_analysis_runs_check" CHECK (outcome <> 'opportunities' or accepted_count > 0);--> statement-breakpoint
CREATE INDEX "opportunity_analysis_runs_company_idx" ON "opportunity_analysis_runs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "opportunity_analysis_runs_outcome_idx" ON "opportunity_analysis_runs" USING btree ("outcome");--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" text NOT NULL,
	"service_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"impact" text NOT NULL,
	"certainty" "certainty" DEFAULT 'inferred' NOT NULL,
	"cited_evidence" jsonb NOT NULL,
	"ai_invocation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_run_id_opportunity_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."opportunity_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_ai_invocation_id_ai_invocations_id_fk" FOREIGN KEY ("ai_invocation_id") REFERENCES "public"."ai_invocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_cited_evidence_check" CHECK (cited_evidence::jsonb <> '[]'::jsonb);--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_title_not_blank" CHECK (length(btrim("title")) > 0);--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_description_not_blank" CHECK (length(btrim("description")) > 0);--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_impact_not_blank" CHECK (length(btrim("impact")) > 0);--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_certainty_check" CHECK (certainty = 'inferred');--> statement-breakpoint
CREATE INDEX "opportunities_company_idx" ON "opportunities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "opportunities_category_idx" ON "opportunities" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "opportunities_service_idx" ON "opportunities" USING btree ("service_id");
