CREATE TYPE "public"."certainty" AS ENUM('observed', 'inferred');--> statement-breakpoint
CREATE TYPE "public"."company_verification_state" AS ENUM('never_checked', 'verified', 'unverified', 'unreachable');--> statement-breakpoint
CREATE TYPE "public"."verification_verdict" AS ENUM('passed', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."lead_priority" AS ENUM('very_high', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('discovered', 'verified', 'analyzing', 'qualified', 'high_priority', 'contacted', 'replied', 'interested', 'meeting', 'proposal', 'won', 'lost', 'not_interested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."outreach_channel" AS ENUM('email', 'linkedin', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('draft', 'pending_approval', 'approved', 'sent', 'replied', 'bounced', 'cancelled');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"country_id" text NOT NULL,
	"city_id" text,
	"industry_id" text NOT NULL,
	"website" text,
	"normalized_domain" text,
	"linkedin_url" text,
	"company_size" text,
	"description" text,
	"discovery_source" text NOT NULL,
	"discovery_source_url" text NOT NULL,
	"discovery_run_id" uuid,
	"verification_state" "company_verification_state" DEFAULT 'never_checked' NOT NULL,
	"verified_at" timestamp with time zone,
	"verification_run_id" uuid,
	"verified" boolean GENERATED ALWAYS AS ((verification_state = 'verified')::boolean) STORED NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"check_id" text NOT NULL,
	"verdict" "verification_verdict" NOT NULL,
	"evidence" text,
	"evidence_url" text,
	"verification_run_id" uuid,
	"ran_at" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_checks_evidence_required" CHECK (("verification_checks"."verdict" IN ('passed', 'failed') AND "verification_checks"."evidence" IS NOT NULL) OR "verification_checks"."verdict" = 'unknown')
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"job_title" text,
	"linkedin_url" text,
	"email" text,
	"phone" text,
	"certainty" "certainty" NOT NULL,
	"research_source" text NOT NULL,
	"source_url" text,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_contact_details_need_a_source" CHECK (("contacts"."email" IS NULL AND "contacts"."phone" IS NULL) OR "contacts"."source_url" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "website_analysis" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"analyzed_url" text NOT NULL,
	"performance_score" integer,
	"accessibility_score" integer,
	"seo_score" integer,
	"mobile_score" integer,
	"ux_score" integer,
	"technology_stack" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"business_opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_analysis_performance_score_range" CHECK ("website_analysis"."performance_score" IS NULL OR ("website_analysis"."performance_score" >= 0 AND "website_analysis"."performance_score" <= 100)),
	CONSTRAINT "website_analysis_accessibility_score_range" CHECK ("website_analysis"."accessibility_score" IS NULL OR ("website_analysis"."accessibility_score" >= 0 AND "website_analysis"."accessibility_score" <= 100)),
	CONSTRAINT "website_analysis_seo_score_range" CHECK ("website_analysis"."seo_score" IS NULL OR ("website_analysis"."seo_score" >= 0 AND "website_analysis"."seo_score" <= 100)),
	CONSTRAINT "website_analysis_mobile_score_range" CHECK ("website_analysis"."mobile_score" IS NULL OR ("website_analysis"."mobile_score" >= 0 AND "website_analysis"."mobile_score" <= 100)),
	CONSTRAINT "website_analysis_ux_score_range" CHECK ("website_analysis"."ux_score" IS NULL OR ("website_analysis"."ux_score" >= 0 AND "website_analysis"."ux_score" <= 100))
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_score" integer NOT NULL,
	"priority" "lead_priority" NOT NULL,
	"business_fit_score" integer NOT NULL,
	"technical_opportunity_score" integer NOT NULL,
	"business_opportunity_score" integer NOT NULL,
	"decision_maker_found_score" integer NOT NULL,
	"company_quality_score" integer NOT NULL,
	"score_explanation" text NOT NULL,
	"recommended_service_id" text,
	"contact_reason" text,
	"status" "lead_status" NOT NULL,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_lead_score_range" CHECK ("leads"."lead_score" >= 0 AND "leads"."lead_score" <= 100),
	CONSTRAINT "leads_score_explanation_not_blank" CHECK (length(btrim("leads"."score_explanation")) > 0),
	CONSTRAINT "leads_component_scores_range" CHECK ("leads"."business_fit_score" BETWEEN 0 AND 100
        AND "leads"."technical_opportunity_score" BETWEEN 0 AND 100
        AND "leads"."business_opportunity_score" BETWEEN 0 AND 100
        AND "leads"."decision_maker_found_score" BETWEEN 0 AND 100
        AND "leads"."company_quality_score" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "outreach" (
	"id" uuid PRIMARY KEY NOT NULL,
	"lead_id" uuid NOT NULL,
	"channel" "outreach_channel" NOT NULL,
	"message_body" text NOT NULL,
	"status" "outreach_status" DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"notes" text,
	"is_example" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_sent_requires_approval" CHECK ("outreach"."status" NOT IN ('sent', 'replied', 'bounced')
        OR ("outreach"."approved_at" IS NOT NULL AND "outreach"."sent_at" IS NOT NULL)),
	CONSTRAINT "outreach_sent_at_requires_approved_at" CHECK ("outreach"."sent_at" IS NULL OR "outreach"."approved_at" IS NOT NULL),
	CONSTRAINT "outreach_sent_at_not_before_approved_at" CHECK ("outreach"."sent_at" IS NULL OR "outreach"."approved_at" IS NULL OR "outreach"."sent_at" >= "outreach"."approved_at"),
	CONSTRAINT "outreach_responded_at_requires_sent_at" CHECK ("outreach"."responded_at" IS NULL OR "outreach"."sent_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_analysis" ADD CONSTRAINT "website_analysis_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_normalized_domain_key" ON "companies" USING btree ("normalized_domain") WHERE "companies"."normalized_domain" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "companies_market_idx" ON "companies" USING btree ("country_id","city_id","industry_id");--> statement-breakpoint
CREATE INDEX "companies_verified_idx" ON "companies" USING btree ("verified");--> statement-breakpoint
CREATE INDEX "companies_normalized_name_idx" ON "companies" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "contacts_company_id_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "website_analysis_company_created_idx" ON "website_analysis" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "leads_company_id_key" ON "leads" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "leads_priority_idx" ON "leads" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "leads_lead_score_idx" ON "leads" USING btree ("lead_score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_lead_status_idx" ON "outreach" USING btree ("lead_id","status");--> statement-breakpoint
ALTER TABLE "verification_checks" ADD CONSTRAINT "verification_checks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_checks_company_ran_at_idx" ON "verification_checks" USING btree ("company_id","ran_at" DESC);