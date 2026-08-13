ALTER TABLE "outreach" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "generated_subject" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "generated_body" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "is_human_edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "prompt_version" integer;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "ai_invocation_id" uuid;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "cited_facts" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "approval_revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "approved_text_hash" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_ai_invocation_id_ai_invocations_id_fk" FOREIGN KEY ("ai_invocation_id") REFERENCES "public"."ai_invocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_generated_requires_invocation" CHECK ("outreach"."generated_body" IS NULL OR "outreach"."ai_invocation_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_approved_text_hash_matches" CHECK ("outreach"."status" <> 'approved' OR "outreach"."approved_text_hash" = md5(coalesce("outreach"."subject", '') || E'
' || "outreach"."message_body"));--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_rejection_requires_reason" CHECK ("outreach"."rejected_at" IS NULL OR length(btrim("outreach"."rejection_reason")) > 0);