CREATE TABLE "technology_detections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"analysis_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"fingerprint_id" text NOT NULL,
	"technology_id" text NOT NULL,
	"category" text NOT NULL,
	"certainty" "certainty" NOT NULL,
	"matched_in" text,
	"matched_text" text,
	"version" text,
	"implied_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technology_detections_analysis_technology_key" UNIQUE("analysis_id","technology_id"),
	CONSTRAINT "technology_detections_observed_requires_evidence" CHECK (("technology_detections"."certainty" != 'observed') OR ("technology_detections"."matched_in" IS NOT NULL AND "technology_detections"."matched_text" IS NOT NULL)),
	CONSTRAINT "technology_detections_inferred_requires_implication" CHECK (("technology_detections"."certainty" != 'inferred') OR ("technology_detections"."implied_by" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "technology_detections" ADD CONSTRAINT "technology_detections_analysis_id_website_analysis_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."website_analysis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_detections" ADD CONSTRAINT "technology_detections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "technology_detections_technology_id_idx" ON "technology_detections" USING btree ("technology_id");--> statement-breakpoint
CREATE INDEX "technology_detections_company_created_idx" ON "technology_detections" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
