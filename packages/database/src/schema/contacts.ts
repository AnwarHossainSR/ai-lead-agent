import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { aiInvocations } from "./ai-invocations";
import { companies } from "./companies";
import { certaintyEnum, contactExtractionMethodEnum, mailDeliverabilityEnum } from "./enums";

/**
 * A person at a company.
 *
 * Contact details are the easiest thing in this product to fabricate — an
 * email pattern plus a name produces something that looks real and is not.
 * The constraint below is the structural answer: a stored email or phone
 * without a source URL is rejected by the database, so a guessed address has
 * nowhere to go.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    jobTitle: text("job_title"),
    linkedinUrl: text("linkedin_url"),
    email: text("email"),
    phone: text("phone"),

    // How well established the person's role is: seen on a team page
    // (`observed`) or concluded from evidence that is also recorded
    // (`inferred`). A guess is not a third value — it is not stored.
    certainty: certaintyEnum("certainty").notNull(),

    // How the contact was obtained
    extractionMethod: contactExtractionMethodEnum("extraction_method").notNull(),

    // Seniority level from configured patterns
    seniorityId: text("seniority_id"),

    // URL where the role was stated
    roleSourceUrl: text("role_source_url"),

    // Mail deliverability for the email domain
    mailDeliverability: mailDeliverabilityEnum("mail_deliverability"),

    // Reference to the model invocation when extraction method is model_interpretation
    aiInvocationId: uuid("ai_invocation_id").references(() => aiInvocations.id, {
      onDelete: "set null",
    }),

    researchSource: text("research_source").notNull(),
    sourceUrl: text("source_url"),

    isExample: boolean("is_example").notNull().default(false),

    doNotContactAt: timestamp("do_not_contact_at", { withTimezone: true }),
    doNotContactReason: text("do_not_contact_reason"),
    doNotContactByAccountId: uuid("do_not_contact_by_account_id").references(() => accounts.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "contacts_contact_details_need_a_source",
      sql`(${table.email} IS NULL AND ${table.phone} IS NULL) OR ${table.sourceUrl} IS NOT NULL`,
    ),
    // Interpreted contacts must reference an invocation
    check(
      "contacts_interpreted_requires_invocation",
      sql`(${table.extractionMethod} != 'model_interpretation') OR ${table.aiInvocationId} IS NOT NULL`,
    ),
    // Seniority requires a job title
    check(
      "contacts_seniority_requires_title",
      sql`${table.seniorityId} IS NULL OR ${table.jobTitle} IS NOT NULL`,
    ),
    check(
      "contacts_do_not_contact_requires_reason",
      sql`${table.doNotContactAt} IS NULL OR length(btrim(${table.doNotContactReason})) > 0`,
    ),
    // Design D5: the actor is set and cleared together with the marker.
    check(
      "contacts_do_not_contact_actor_pairs_with_timestamp",
      sql`(${table.doNotContactAt} IS NULL) = (${table.doNotContactByAccountId} IS NULL)`,
    ),
    index("contacts_company_id_idx").on(table.companyId),
  ],
);

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;
