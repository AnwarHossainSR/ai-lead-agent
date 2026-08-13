CREATE TYPE "public"."outreach_response_kind" AS ENUM('replied', 'bounced', 'unsubscribed', 'no_response');--> statement-breakpoint
CREATE TABLE "outreach_responses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"outreach_id" uuid NOT NULL,
	"kind" "outreach_response_kind" NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"body" text,
	"proposed_category_id" text,
	"confirmed_category_id" text NOT NULL,
	"ai_invocation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "do_not_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "do_not_contact_reason" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "do_not_contact_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "do_not_contact_reason" text;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "sent_means" text;--> statement-breakpoint
ALTER TABLE "outreach_responses" ADD CONSTRAINT "outreach_responses_outreach_id_outreach_id_fk" FOREIGN KEY ("outreach_id") REFERENCES "public"."outreach"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_responses" ADD CONSTRAINT "outreach_responses_ai_invocation_id_ai_invocations_id_fk" FOREIGN KEY ("ai_invocation_id") REFERENCES "public"."ai_invocations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_responses_outreach_id_idx" ON "outreach_responses" USING btree ("outreach_id","received_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_do_not_contact_requires_reason" CHECK ("companies"."do_not_contact_at" IS NULL OR length(btrim("companies"."do_not_contact_reason")) > 0);--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_do_not_contact_requires_reason" CHECK ("contacts"."do_not_contact_at" IS NULL OR length(btrim("contacts"."do_not_contact_reason")) > 0);--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_sent_means_required" CHECK ("outreach"."sent_at" IS NULL OR "outreach"."sent_means" IS NOT NULL);--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_response_before_send() RETURNS trigger AS $$
BEGIN
  IF NEW.received_at < (SELECT sent_at FROM outreach WHERE id = NEW.outreach_id) THEN
    RAISE EXCEPTION 'Response received_at % is before the message sent_at.', NEW.received_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "outreach_responses_reject_before_send"
  BEFORE INSERT ON "outreach_responses"
  FOR EACH ROW EXECUTE FUNCTION reject_response_before_send();--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_outreach_for_do_not_contact() RETURNS trigger AS $$
DECLARE
  v_company_do_not_contact_at timestamp with time zone;
BEGIN
  SELECT companies.do_not_contact_at INTO v_company_do_not_contact_at
  FROM companies
  JOIN leads ON leads.company_id = companies.id
  WHERE leads.id = NEW.lead_id;

  IF FOUND AND v_company_do_not_contact_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot create outreach for a company marked as do not contact.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "outreach_reject_do_not_contact"
  BEFORE INSERT ON "outreach"
  FOR EACH ROW EXECUTE FUNCTION reject_outreach_for_do_not_contact();