ALTER TABLE "outreach" DROP CONSTRAINT "outreach_approved_text_hash_matches";--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_approved_text_hash_matches" CHECK ("outreach"."status" <> 'approved' OR ("outreach"."approved_text_hash" IS NOT NULL AND "outreach"."approved_text_hash" = md5(coalesce("outreach"."subject", '') || E'
' || "outreach"."message_body")));