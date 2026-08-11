import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { discoveryRuns } from "./discovery";
import { companyVerificationStateEnum } from "./enums";

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

    // Whether a human or a verification step has confirmed the company exists
    // and the details match. Discovery alone does not make it true.
    // Now derived from verification_state rather than set directly.
    verified: boolean("verified")
      .notNull()
      .generatedAlwaysAs(sql`(verification_state = 'verified')::boolean`),

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
    index("companies_verified_idx").on(table.verified),
    // Supports "who else is called this?" when neither record has a website.
    index("companies_normalized_name_idx").on(table.normalizedName),
  ],
);

export type CompanyRow = typeof companies.$inferSelect;
export type CompanyInsert = typeof companies.$inferInsert;
