CREATE TABLE "lead_research_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"sections" jsonb NOT NULL,
	"cited_facts" jsonb NOT NULL,
	"unknown_facts" jsonb DEFAULT '[]' NOT NULL,
	"rejections" jsonb DEFAULT '[]' NOT NULL,
	"prompt_version" integer NOT NULL,
	"ai_invocation_id" uuid NOT NULL,
	"is_generated" text DEFAULT 'true' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_research_summaries_is_generated" CHECK ("lead_research_summaries"."is_generated" = 'true'),
	CONSTRAINT "lead_research_summaries_cited_facts_non_empty" CHECK (jsonb_array_length("lead_research_summaries"."cited_facts") > 0)
);
--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "scored_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "lead_research_summaries" ADD CONSTRAINT "lead_research_summaries_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_research_summaries" ADD CONSTRAINT "lead_research_summaries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_research_summaries" ADD CONSTRAINT "lead_research_summaries_ai_invocation_id_ai_invocations_id_fk" FOREIGN KEY ("ai_invocation_id") REFERENCES "public"."ai_invocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_research_summaries_lead_created_idx" ON "lead_research_summaries" USING btree ("lead_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);