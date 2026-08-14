CREATE TYPE "public"."account_role" AS ENUM('operator', 'viewer');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "account_role" NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid,
	"event" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"outcome" text NOT NULL,
	"source_address" "inet",
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_account_id_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "audit_log_account_id_idx" ON "audit_log" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "audit_log_event_created_at_idx" ON "audit_log" USING btree ("event","created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_audit_log_update() RETURNS trigger AS $$
BEGIN
  -- The one permitted update is the ON DELETE SET NULL action on
  -- account_id — PostgreSQL implements that FK action as an UPDATE against
  -- this table, so blocking every UPDATE unconditionally would also block
  -- an account being deleted (design D6 wants both: append-only, and an
  -- audit row that survives its account). Anything else is refused.
  IF NEW.account_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.event = OLD.event
     AND NEW.subject_type IS NOT DISTINCT FROM OLD.subject_type
     AND NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id
     AND NEW.outcome = OLD.outcome
     AND NEW.source_address IS NOT DISTINCT FROM OLD.source_address
     AND NEW.detail = OLD.detail
     AND NEW.created_at = OLD.created_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'audit_log is append-only: UPDATE is not permitted.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_reject_update" ON "audit_log";--> statement-breakpoint
CREATE TRIGGER "audit_log_reject_update"
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_update();--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_audit_log_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: DELETE is not permitted.';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "audit_log_reject_delete" ON "audit_log";--> statement-breakpoint
CREATE TRIGGER "audit_log_reject_delete"
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_delete();