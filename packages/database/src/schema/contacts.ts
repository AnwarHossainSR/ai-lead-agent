import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { companies } from "./companies";
import { certaintyEnum } from "./enums";

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

    researchSource: text("research_source").notNull(),
    sourceUrl: text("source_url"),

    isExample: boolean("is_example").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "contacts_contact_details_need_a_source",
      sql`(${table.email} IS NULL AND ${table.phone} IS NULL) OR ${table.sourceUrl} IS NOT NULL`,
    ),
    index("contacts_company_id_idx").on(table.companyId),
  ],
);

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;
