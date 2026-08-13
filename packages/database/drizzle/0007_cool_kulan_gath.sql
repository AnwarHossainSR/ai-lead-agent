CREATE TABLE "lead_score_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"website_quality_score" integer NOT NULL,
	"technology_fit_score" integer NOT NULL,
	"opportunity_score" integer NOT NULL,
	"contact_score" integer NOT NULL,
	"business_fit_score" integer NOT NULL,
	"total_score" integer NOT NULL,
	"priority" text NOT NULL,
	"explanation" text NOT NULL,
	"weight_version" integer NOT NULL,
	"evidence_refs" text NOT NULL,
	"missing" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_score_snapshots_explanation_not_blank" CHECK (length(btrim("lead_score_snapshots"."explanation")) > 0),
	CONSTRAINT "lead_score_snapshots_total_range" CHECK ("lead_score_snapshots"."total_score" >= 0 AND "lead_score_snapshots"."total_score" <= 100),
	CONSTRAINT "lead_score_snapshots_total_equals_weighted" CHECK ("lead_score_snapshots"."total_score" = "lead_score_snapshots"."website_quality_score" + "lead_score_snapshots"."technology_fit_score" + "lead_score_snapshots"."opportunity_score" + "lead_score_snapshots"."contact_score" + "lead_score_snapshots"."business_fit_score")
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "weight_version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "scored_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_score_snapshots" ADD CONSTRAINT "lead_score_snapshots_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_score_snapshots" ADD CONSTRAINT "lead_score_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_score_snapshots_lead_created_idx" ON "lead_score_snapshots" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_weight_version_idx" ON "leads" USING btree ("weight_version");