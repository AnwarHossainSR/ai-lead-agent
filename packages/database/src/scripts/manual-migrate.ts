import postgres from "postgres";

const client = postgres("postgresql://postgres:postgres@localhost:5432/mela");

async function main() {
  await client.unsafe(`
    -- Fix drizzle migration history for local database
    INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at)
    VALUES
      (4, '36123b7e16956dd8db7b65f795ea2ba8e1b4c1aab97f12a453872705753062fb', EXTRACT(EPOCH FROM NOW())::bigint),
      (5, 'a69c8024664bf693e21257042c91f905875985057d242cd9ed9bf4add0692557', EXTRACT(EPOCH FROM NOW())::bigint),
      (11, 'ca001cedf9dae9582747d88265cbbd416d80d94bc46b19a0320fe339a357cf2e', EXTRACT(EPOCH FROM NOW())::bigint)
    ON CONFLICT (id) DO NOTHING;

    -- Apply outreach_response_kind enum
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outreach_response_kind') THEN
        CREATE TYPE "public"."outreach_response_kind" AS ENUM('replied', 'bounced', 'unsubscribed', 'no_response');
      END IF;
    END $$;

    -- Apply outreach_responses table
    CREATE TABLE IF NOT EXISTS "outreach_responses" (
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

    CREATE INDEX IF NOT EXISTS "outreach_responses_outreach_id_idx" ON "outreach_responses" USING btree ("outreach_id","received_at" DESC NULLS LAST);

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_responses_outreach_id_outreach_id_fk') THEN
        ALTER TABLE "outreach_responses" ADD CONSTRAINT "outreach_responses_outreach_id_outreach_id_fk" FOREIGN KEY ("outreach_id") REFERENCES "public"."outreach"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_responses_ai_invocation_id_ai_invocations_id_fk') THEN
        ALTER TABLE "outreach_responses" ADD CONSTRAINT "outreach_responses_ai_invocation_id_ai_invocations_id_fk" FOREIGN KEY ("ai_invocation_id") REFERENCES "public"."ai_invocations"("id") ON DELETE restrict ON UPDATE no action;
      END IF;
    END $$;

    -- Apply do_not_contact columns to companies
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "do_not_contact_at" timestamp with time zone;
    ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "do_not_contact_reason" text;

    -- Apply do_not_contact columns to contacts
    ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "do_not_contact_at" timestamp with time zone;
    ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "do_not_contact_reason" text;

    -- Apply sent_means to outreach
    ALTER TABLE "outreach" ADD COLUMN IF NOT EXISTS "sent_means" text;

    -- Apply CHECK constraints
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_do_not_contact_requires_reason') THEN
        ALTER TABLE "companies" ADD CONSTRAINT "companies_do_not_contact_requires_reason" CHECK ("companies"."do_not_contact_at" IS NULL OR length(btrim("companies"."do_not_contact_reason")) > 0);
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_do_not_contact_requires_reason') THEN
        ALTER TABLE "contacts" ADD CONSTRAINT "contacts_do_not_contact_requires_reason" CHECK ("contacts"."do_not_contact_at" IS NULL OR length(btrim("contacts"."do_not_contact_reason")) > 0);
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_sent_means_required') THEN
        ALTER TABLE "outreach" ADD CONSTRAINT "outreach_sent_means_required" CHECK ("outreach"."sent_at" IS NULL OR "outreach"."sent_means" IS NOT NULL);
      END IF;
    END $$;

    -- Apply response kind check
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outreach_responses_kind_check') THEN
        ALTER TABLE "outreach_responses" ADD CONSTRAINT "outreach_responses_kind_check" CHECK ("outreach_responses"."kind" IN ('replied', 'bounced', 'unsubscribed', 'no_response'));
      END IF;
    END $$;

    -- Apply triggers
    CREATE OR REPLACE FUNCTION reject_response_before_send() RETURNS trigger AS $$
    BEGIN
      IF NEW.received_at < (SELECT sent_at FROM outreach WHERE id = NEW.outreach_id) THEN
        RAISE EXCEPTION 'Response received_at % is before the message sent_at.', NEW.received_at;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS "outreach_responses_reject_before_send" ON "outreach_responses";
    CREATE TRIGGER "outreach_responses_reject_before_send"
      BEFORE INSERT ON "outreach_responses"
      FOR EACH ROW EXECUTE FUNCTION reject_response_before_send();

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
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS "outreach_reject_do_not_contact" ON "outreach";
    CREATE TRIGGER "outreach_reject_do_not_contact"
      BEFORE INSERT ON "outreach"
      FOR EACH ROW EXECUTE FUNCTION reject_outreach_for_do_not_contact();

    -- Mark our migration as applied
    INSERT INTO drizzle.__drizzle_migrations (id, hash, created_at)
    VALUES (12, '60be0d24dba2a3c839dc407613c04a0dbb5b1d75f07c2a1132559c46e19a8429', EXTRACT(EPOCH FROM NOW())::bigint)
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log("Migration applied successfully.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
