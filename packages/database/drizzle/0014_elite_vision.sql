ALTER TABLE "companies" ADD COLUMN "do_not_contact_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "do_not_contact_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "approved_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "sent_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "outreach" ADD COLUMN "rejected_by_account_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_do_not_contact_by_account_id_accounts_id_fk" FOREIGN KEY ("do_not_contact_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_do_not_contact_by_account_id_accounts_id_fk" FOREIGN KEY ("do_not_contact_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_approved_by_account_id_accounts_id_fk" FOREIGN KEY ("approved_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_sent_by_account_id_accounts_id_fk" FOREIGN KEY ("sent_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_rejected_by_account_id_accounts_id_fk" FOREIGN KEY ("rejected_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_do_not_contact_actor_pairs_with_timestamp" CHECK (("companies"."do_not_contact_at" IS NULL) = ("companies"."do_not_contact_by_account_id" IS NULL));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_do_not_contact_actor_pairs_with_timestamp" CHECK (("contacts"."do_not_contact_at" IS NULL) = ("contacts"."do_not_contact_by_account_id" IS NULL));--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_approved_actor_pairs_with_timestamp" CHECK (("outreach"."approved_at" IS NULL) = ("outreach"."approved_by_account_id" IS NULL));--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_rejected_actor_pairs_with_timestamp" CHECK (("outreach"."rejected_at" IS NULL) = ("outreach"."rejected_by_account_id" IS NULL));--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_sent_actor_pairs_with_timestamp" CHECK (("outreach"."sent_at" IS NULL) = ("outreach"."sent_by_account_id" IS NULL));