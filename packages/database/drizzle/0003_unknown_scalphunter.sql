CREATE TYPE "public"."website_analysis_outcome" AS ENUM('completed', 'partial', 'blocked', 'skipped', 'failed');--> statement-breakpoint
CREATE TABLE "verification_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"check_id" text NOT NULL,
	"verdict" "verification_verdict" NOT NULL,
	"evidence" text,
	"evidence_url" text,
	"verification_run_id" uuid,
	"ran_at" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_checks_evidence_required" CHECK (("verification_checks"."verdict" IN ('passed', 'failed') AND "verification_checks"."evidence" IS NOT NULL)
          OR "verification_checks"."verdict" = 'unknown')
);
--> statement-breakpoint
DROP INDEX "companies_verified_idx";--> statement-breakpoint
ALTER TABLE "website_analysis" ADD COLUMN "outcome" "website_analysis_outcome" DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "website_analysis" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "website_analysis" ADD COLUMN "http_status" integer;--> statement-breakpoint
ALTER TABLE "website_analysis" ADD COLUMN "desktop_screenshot_path" text;--> statement-breakpoint
ALTER TABLE "website_analysis" ADD COLUMN "mobile_screenshot_path" text;--> statement-breakpoint
ALTER TABLE "website_analysis" ADD COLUMN "rendered_html_path" text;--> statement-breakpoint
ALTER TABLE "website_analysis" ADD COLUMN "audit_report_path" text;--> statement-breakpoint
ALTER TABLE "website_analysis" ADD COLUMN "unverified_override" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_checks" ADD CONSTRAINT "verification_checks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_checks_company_ran_at_idx" ON "verification_checks" USING btree ("company_id","ran_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "website_analysis_company_outcome_idx" ON "website_analysis" USING btree ("company_id","outcome");--> statement-breakpoint
ALTER TABLE "companies" DROP COLUMN "verified";--> statement-breakpoint
ALTER TABLE "website_analysis" ADD CONSTRAINT "website_analysis_failure_reason_required" CHECK (("website_analysis"."outcome" = 'completed') OR ("website_analysis"."failure_reason" IS NOT NULL AND "website_analysis"."failure_reason" != ''));--> statement-breakpoint
ALTER TABLE "website_analysis" ADD CONSTRAINT "website_analysis_no_scores_on_failure" CHECK (("website_analysis"."outcome" IN ('blocked', 'skipped', 'failed')) => (
        "website_analysis"."performance_score" IS NULL AND
        "website_analysis"."accessibility_score" IS NULL AND
        "website_analysis"."seo_score" IS NULL AND
        "website_analysis"."mobile_score" IS NULL AND
        "website_analysis"."ux_score" IS NULL
      ));