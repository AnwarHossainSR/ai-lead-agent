import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { discoveryRuns } from "./discovery";
import { companyVerificationStateEnum } from "./enums";

// `verified` is a PostgreSQL generated column: GENERATED ALWAYS AS
// ((verification_state = 'verified')::boolean) STORED.
// Drizzle ORM cannot insert into generated columns (it includes them in
// every INSERT), so it is intentionally absent from this schema.  The
// column still exists in PostgreSQL; queries that need it can select it
// via raw SQL or rely on `verification_state` directly.

/**
 * A company that has been discovered and may become a lead.
 *
 * Every nullable column means "not established". None of them has a default,
 * because a default is a fabricated fact: an empty description would read as
 * "this company has no description" rather than "nobody has researched it".
 * The read layer maps NULL to the `unknown` marker from `@mela/shared`.
 */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey(),

    // Observed, and required: a company with no name is not a company.
    name: text("name").notNull(),
    // Derived from `name` by normalizeCompanyName. A comparison key for
    // spotting duplicates that have no website; never displayed.
    normalizedName: text("normalized_name").notNull(),

    // Configuration identifiers. Stored as text rather than PostgreSQL enums
    // so that adding a city or an industry stays a configuration edit — the
    // write helpers validate them against @mela/config (design D4).
    countryId: text("country_id").notNull(),
    cityId: text("city_id"),
    industryId: text("industry_id").notNull(),

    website: text("website"),
    // Derived from `website` by normalizeDomain. The deduplication key.
    normalizedDomain: text("normalized_domain"),

    linkedinUrl: text("linkedin_url"),
    companySize: text("company_size"),
    description: text("description"),

    // Provenance. NOT NULL on both: a company nobody can trace back to where
    // it was found is indistinguishable from an invented one.
    discoverySource: text("discovery_source").notNull(),
    discoverySourceUrl: text("discovery_source_url").notNull(),

    // The run that first found this company, when one did. NULL for a company
    // entered by hand. Deleting a run clears this rather than the company: a
    // run is housekeeping, a company is a record of a real business.
    discoveryRunId: uuid("discovery_run_id").references(() => discoveryRuns.id, {
      onDelete: "set null",
    }),

    // Verification state derived from check results.
    verificationState: companyVerificationStateEnum("verification_state")
      .notNull()
      .default("never_checked"),
    // When the verification state was last derived.
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // The verification run that derived the current state.
    verificationRunId: uuid("verification_run_id"),

    // Marks rows created by the seed script so example data is never mistaken
    // for researched data.
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
    // Partial, so the database rejects a second company on the same domain
    // while any number of website-less companies coexist. A plain unique index
    // would treat NULLs as distinct in PostgreSQL and so allow duplicates, but
    // stating the intent explicitly keeps it true if NULLS NOT DISTINCT is
    // ever added.
    uniqueIndex("companies_normalized_domain_key")
      .on(table.normalizedDomain)
      .where(sql`${table.normalizedDomain} IS NOT NULL`),

    // Backs the dashboard's market and sector filters (design D6).
    index("companies_market_idx").on(table.countryId, table.cityId, table.industryId),
    // NOTE: companies_verified_idx exists in PostgreSQL (on the generated
    // `verified` column) but is not defined here because Drizzle does not
    // know about that column.  It is created via raw SQL in the migration.
    // Supports "who else is called this?" when neither record has a website.
    index("companies_normalized_name_idx").on(table.normalizedName),

    check(
      "companies_do_not_contact_requires_reason",
      sql`${table.doNotContactAt} IS NULL OR length(btrim(${table.doNotContactReason})) > 0`,
    ),
    // Design D5: the actor is set and cleared together with the marker.
    check(
      "companies_do_not_contact_actor_pairs_with_timestamp",
      sql`(${table.doNotContactAt} IS NULL) = (${table.doNotContactByAccountId} IS NULL)`,
    ),
  ],
);

export type CompanyRow = typeof companies.$inferSelect;
export type CompanyInsert = typeof companies.$inferInsert;
