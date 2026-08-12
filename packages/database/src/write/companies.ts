import { normalizeCompanyName, normalizeDomain } from "@mela/shared";
import { and, eq, sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type CompanyRow, companies } from "../schema/companies";
import { type VerificationVerdict } from "../schema/enums";
import { verificationChecks } from "../schema/verification-checks";
import { type Assignments, databaseNow } from "./clock";
import {
  DuplicateCompanyError,
  RecordNotFoundError,
  isForeignKeyViolation,
  isUniqueViolation,
  parseInput,
} from "./errors";
import {
  cityIdSchema,
  countryIdSchema,
  industryIdSchema,
  refineCityBelongsToCountry,
} from "./identifiers";

/**
 * The write API for companies.
 *
 * `companies` itself is exported for reads. Inserting through it directly
 * skips everything below — the configuration checks, the derived normalization
 * keys — which is why these functions are the documented write path (design
 * D4).
 */

const NORMALIZED_DOMAIN_CONSTRAINT = "companies_normalized_domain_key";

const optionalFact = z
  .string()
  .trim()
  .min(1, "Expected a value or nothing at all; a blank string is not a fact.")
  .nullish();

export const insertCompanyInputSchema = z
  .object({
    name: z.string().trim().min(1, "Expected the company name."),

    countryId: countryIdSchema,
    cityId: cityIdSchema.nullish(),
    industryId: industryIdSchema,

    website: optionalFact,
    linkedinUrl: optionalFact,
    companySize: optionalFact,
    description: optionalFact,

    // Required, and required to be meaningful: a company nobody can trace back
    // to where it was found cannot be told apart from an invented one.
    discoverySource: z.string().trim().min(1, "Expected the source this company was found in."),
    discoverySourceUrl: z.url("Expected the URL this company was found at."),

    // The run that first found this company, when one did. Optional: a
    // manually entered company has no run.
    discoveryRunId: z.string().uuid("Expected the discovery run identifier.").nullish(),

    // verified is no longer a parameter — it is derived from verification_state
    // and written only through applyVerificationResult.

    isExample: z.boolean().default(false),
  })
  .superRefine(refineCityBelongsToCountry);

export type InsertCompanyInput = z.input<typeof insertCompanyInputSchema>;

export async function insertCompany(
  executor: Executor,
  input: InsertCompanyInput,
): Promise<CompanyRow> {
  const value = parseInput("The company", insertCompanyInputSchema, input);

  // Both normalized keys are derived here rather than accepted from the
  // caller, so the deduplication key can never disagree with the value it was
  // derived from.
  const normalizedDomain = normalizeDomain(value.website);
  const normalizedName = normalizeCompanyName(value.name);

  try {
    const [row] = await executor
      .insert(companies)
      .values({
        id: uuidv7(),
        name: value.name,
        // normalizeCompanyName returns null only for a name made entirely of
        // punctuation. Falling back to the lowercased name keeps such a record
        // storable and comparable without inventing a name for it.
        normalizedName: normalizedName ?? value.name.toLowerCase(),
        countryId: value.countryId,
        cityId: value.cityId ?? null,
        industryId: value.industryId,
        website: value.website ?? null,
        normalizedDomain,
        linkedinUrl: value.linkedinUrl ?? null,
        companySize: value.companySize ?? null,
        description: value.description ?? null,
        discoverySource: value.discoverySource,
        discoverySourceUrl: value.discoverySourceUrl,
        discoveryRunId: value.discoveryRunId ?? null,
        // verified is derived from verification_state, not set directly
        isExample: value.isExample,
      })
      .returning();

    if (row === undefined) {
      throw new Error("The company insert returned no row.");
    }

    return row;
  } catch (error) {
    if (normalizedDomain !== null && isUniqueViolation(error, NORMALIZED_DOMAIN_CONSTRAINT)) {
      const existing = await findCompanyByNormalizedDomain(executor, normalizedDomain);
      throw new DuplicateCompanyError(normalizedDomain, existing?.id ?? null);
    }

    throw error;
  }
}

export async function findCompanyByNormalizedDomain(
  executor: Executor,
  normalizedDomain: string,
): Promise<CompanyRow | undefined> {
  const [row] = await executor
    .select()
    .from(companies)
    .where(eq(companies.normalizedDomain, normalizedDomain))
    .limit(1);

  return row;
}

/**
 * The second deduplication key (design D5): normalized name within the same
 * country. Deliberately country-scoped — "Al Noor Trading" in Dubai and in
 * Riyadh are usually different companies — and returned at most once.
 */
export async function findCompanyByNormalizedName(
  executor: Executor,
  countryId: string,
  normalizedName: string,
): Promise<CompanyRow | undefined> {
  const [row] = await executor
    .select()
    .from(companies)
    .where(and(eq(companies.countryId, countryId), eq(companies.normalizedName, normalizedName)))
    .limit(1);

  return row;
}

export const updateCompanyInputSchema = z
  .object({
    name: z.string().trim().min(1, "Expected the company name.").optional(),
    countryId: countryIdSchema.optional(),
    cityId: cityIdSchema.nullish(),
    industryId: industryIdSchema.optional(),
    website: optionalFact,
    linkedinUrl: optionalFact,
    companySize: optionalFact,
    description: optionalFact,
    // verified is no longer updatable — it is derived from verification_state
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    "Expected at least one field to change.",
  );

export type UpdateCompanyInput = z.input<typeof updateCompanyInputSchema>;

/**
 * Applies a partial update, re-deriving the normalization keys whenever the
 * values they come from change, and advancing `updated_at`. The timestamp is
 * maintained here rather than by a trigger so there is one mechanism, visible
 * in code (design D6).
 */
export async function updateCompany(
  executor: Executor,
  id: string,
  input: UpdateCompanyInput,
): Promise<CompanyRow> {
  const value = parseInput("The company update", updateCompanyInputSchema, input);

  const changes: Assignments<typeof companies.$inferInsert> = { updatedAt: databaseNow() };

  if (value.name !== undefined) {
    changes.name = value.name;
    changes.normalizedName = normalizeCompanyName(value.name) ?? value.name.toLowerCase();
  }
  if (value.website !== undefined) {
    changes.website = value.website ?? null;
    changes.normalizedDomain = normalizeDomain(value.website);
  }
  if (value.countryId !== undefined) changes.countryId = value.countryId;
  if (value.cityId !== undefined) changes.cityId = value.cityId ?? null;
  if (value.industryId !== undefined) changes.industryId = value.industryId;
  if (value.linkedinUrl !== undefined) changes.linkedinUrl = value.linkedinUrl ?? null;
  if (value.companySize !== undefined) changes.companySize = value.companySize ?? null;
  if (value.description !== undefined) changes.description = value.description ?? null;
  // verified is derived from verification_state, not set directly

  try {
    const [row] = await executor
      .update(companies)
      .set(changes)
      .where(eq(companies.id, id))
      .returning();

    if (row === undefined) {
      throw new RecordNotFoundError("company", id);
    }

    return row;
  } catch (error) {
    const domain = changes.normalizedDomain;

    if (typeof domain === "string" && isUniqueViolation(error, NORMALIZED_DOMAIN_CONSTRAINT)) {
      const existing = await findCompanyByNormalizedDomain(executor, domain);
      throw new DuplicateCompanyError(domain, existing?.id ?? null);
    }

    throw error;
  }
}

/**
 * The verdict derivation rules for verification:
 * 1. If any required check is 'failed' → 'unverified'
 * 2. If any required check is 'unknown' → 'unverified'
 * 3. If all required checks are 'passed' → 'verified'
 * 4. Otherwise → 'unknown'
 */
export type VerificationCheckResult = {
  checkId: string;
  status: "passed" | "failed" | "unknown";
  required: boolean;
};

export function deriveVerificationState(
  checks: readonly VerificationCheckResult[],
): { state: "verified" | "unverified" | "unreachable" | "never_checked"; verdict: VerificationVerdict } {
  if (checks.length === 0) {
    return { state: "never_checked", verdict: "unknown" };
  }

  const requiredChecks = checks.filter((c) => c.required);

  // If any required check failed, the overall verdict is 'failed'
  const anyRequiredFailed = requiredChecks.some((c) => c.status === "failed");
  // If any required check is unknown, the overall verdict is 'unknown'
  const anyRequiredUnknown = requiredChecks.some((c) => c.status === "unknown");
  // All required checks passed
  const allRequiredPassed =
    requiredChecks.length > 0 && requiredChecks.every((c) => c.status === "passed");

  let verdict: VerificationVerdict;
  if (anyRequiredFailed) {
    verdict = "failed";
  } else if (anyRequiredUnknown) {
    verdict = "unknown";
  } else if (allRequiredPassed) {
    verdict = "passed";
  } else {
    // Edge case: no required checks, or all checks are optional and none passed
    verdict = "unknown";
  }

  let state: "verified" | "unverified" | "unreachable" | "never_checked";
  switch (verdict) {
    case "passed":
      state = "verified";
      break;
    case "failed":
      state = "unverified";
      break;
    case "unknown":
      // If we got here with no required checks, treat as unreachable
      state = requiredChecks.length === 0 ? "unreachable" : "unverified";
      break;
  }

  return { state, verdict };
}

export const applyVerificationResultInputSchema = z.object({
  companyId: z.string().uuid("Expected the company identifier."),
  verificationRunId: z.string().uuid("Expected the verification run identifier."),
  checks: z.array(
    z.object({
      checkId: z.string(),
      status: z.enum(["passed", "failed", "unknown"]),
      required: z.boolean(),
      evidence: z.string().optional(),
      evidenceUrl: z.string().optional(),
    }),
  ),
  verdict: z.enum(["passed", "failed", "unknown"]),
});

export type ApplyVerificationResultInput = z.input<typeof applyVerificationResultInputSchema>;

/**
 * Applies a verification result to a company, updating its verification state
 * and related fields, and persisting each check record. This is the write
 * path for verification outcomes.
 */
export async function applyVerificationResult(
  executor: Executor,
  input: ApplyVerificationResultInput,
): Promise<CompanyRow> {
  const value = parseInput("The verification result", applyVerificationResultInputSchema, input);

  const { state } = deriveVerificationState(value.checks);

  // Insert check records first — they accumulate across runs.
  if (value.checks.length > 0) {
    const now = new Date();
    try {
      await executor.insert(verificationChecks).values(
        value.checks.map((check) => ({
          id: uuidv7(),
          companyId: value.companyId,
          checkId: check.checkId,
          verdict: check.status,
          evidence: check.evidence ?? null,
          evidenceUrl: check.evidenceUrl ?? null,
          verificationRunId: value.verificationRunId,
          ranAt: now,
        })),
      );
    } catch (error) {
      // FK violation means the company doesn't exist — surface as RecordNotFoundError.
      if (isForeignKeyViolation(error)) {
        throw new RecordNotFoundError("company", value.companyId);
      }
      throw error;
    }
  }

  const changes: Assignments<typeof companies.$inferInsert> = {
    verificationState: state,
    verifiedAt: databaseNow(),
    verificationRunId: value.verificationRunId,
  };

  const [row] = await executor
      .update(companies)
      .set(changes)
      .where(eq(companies.id, value.companyId))
      .returning();

    if (row === undefined) {
      throw new RecordNotFoundError("company", value.companyId);
    }

    return row;
}

/**
 * Lists companies that haven't been verified within the specified staleness window.
 * Used by the verification run scheduler to identify candidates for re-verification.
 */
export async function listStaleCompanies(
  executor: Executor,
  staleDays: number,
): Promise<CompanyRow[]> {
  const cutoffDate = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const rows = await executor
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.isExample, false),
        // Never checked or checked before the staleness window
        sql`(${companies.verificationState} = 'never_checked' OR ${companies.verifiedAt} < ${cutoffDate.toISOString()})`,
      ),
    )
    .limit(100);

  return rows;
}
