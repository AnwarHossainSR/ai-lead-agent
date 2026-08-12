import {
  type CompanyRow,
  DuplicateCompanyError,
  type Executor,
  findCompanyByNormalizedDomain,
  findCompanyByNormalizedName,
  insertCompany,
  recordCompanyDiscoverySource,
} from "@mela/database";
import { normalizeCompanyName, normalizeDomain } from "@mela/shared";

import type { DiscoveredCandidate } from "./sources/source";

/**
 * What the deduplication service is asked to decide on.
 *
 * The territory is the run's configured territory, not anything a source
 * claimed: the run is scoped to a country, city and industry, and that is what
 * a stored company inherits.
 */
export interface DedupInput {
  readonly candidate: DiscoveredCandidate;
  readonly runId: string;
  readonly sourceId: string;
  readonly countryId: string;
  readonly cityId?: string;
  readonly industryId: string;
}

/**
 * The verdict on one candidate. `stored` means a new company row was created;
 * `duplicate` means the candidate mapped to an already-known company and only
 * that company's provenance was updated (design D5, task 5.2). The run counts
 * the two differently, so they are distinguished rather than merged.
 */
export type DedupResult =
  | { readonly kind: "stored"; readonly company: CompanyRow }
  | { readonly kind: "duplicate"; readonly company: CompanyRow };

/**
 * Deterministic candidate deduplication (design D5) — and deliberately the
 * only rule that decides what gets stored.
 *
 * Order of comparison:
 *
 * 1. If the candidate has a website, normalize it. A company already on that
 *    normalized domain is the same company — the database enforces this with a
 *    partial unique index even if this code is wrong.
 * 2. If it has no usable website, compare the normalized name within the same
 *    country. A match is the same company.
 * 3. Otherwise it is new.
 *
 * A match updates the existing company's provenance (which source found it,
 * and where) instead of creating a second row. The same-name comparison is
 * deliberately country-scoped and exact: fuzzy or cross-country matching would
 * merge "Al Noor Trading" in Dubai with "Al Noor Trading" in Riyadh, which are
 * usually different companies.
 *
 * No language model is consulted anywhere in this path.
 */
export class DedupService {
  /**
   * Decides whether `candidate` is a new company or an already-known one,
   * and persists the outcome: a new company row on a miss, a provenance
   * record on either.
   *
   * `executor` is passed per call so a run can compose several of these
   * inside one transaction.
   */
  async deduplicate(executor: Executor, input: DedupInput): Promise<DedupResult> {
    const existing = await this.findMatch(executor, input);

    if (existing !== undefined) {
      return this.recordDuplicate(executor, existing, input);
    }

    try {
      const company = await insertCompany(executor, {
        name: input.candidate.name,
        countryId: input.countryId,
        cityId: input.cityId,
        industryId: input.industryId,
        website: input.candidate.website,
        linkedinUrl: input.candidate.linkedinUrl,
        companySize: input.candidate.companySize,
        description: input.candidate.description,
        discoverySource: input.sourceId,
        discoverySourceUrl: input.candidate.sourceUrl,
        discoveryRunId: input.runId,
      });

      await recordCompanyDiscoverySource(executor, {
        companyId: company.id,
        sourceId: input.sourceId,
        sourceUrl: input.candidate.sourceUrl,
      });

      return { kind: "stored", company };
    } catch (error) {
      // The partial unique index on normalized_domain is the backstop for step
      // 1, and it can fire on a race the read-then-write did not see: two
      // territories' runs, or a run against a company another run just stored.
      // A database refusal here is not a failure — the candidate mapped to a
      // company that now exists, so it is a duplicate.
      if (error instanceof DuplicateCompanyError) {
        const raceWinner = await findCompanyByNormalizedDomain(executor, error.normalizedDomain);

        if (raceWinner !== undefined) {
          return this.recordDuplicate(executor, raceWinner, input);
        }
      }

      throw error;
    }
  }

  private async recordDuplicate(
    executor: Executor,
    company: CompanyRow,
    input: DedupInput,
  ): Promise<DedupResult> {
    await recordCompanyDiscoverySource(executor, {
      companyId: company.id,
      sourceId: input.sourceId,
      sourceUrl: input.candidate.sourceUrl,
    });

    return { kind: "duplicate", company };
  }

  /**
   * The three-step match from design D5. A candidate whose website does not
   * normalize to a registrable domain has no usable domain key and falls
   * through to the name-within-country comparison.
   */
  private async findMatch(executor: Executor, input: DedupInput): Promise<CompanyRow | undefined> {
    const normalizedDomain = normalizeDomain(input.candidate.website);

    if (normalizedDomain !== null) {
      const byDomain = await findCompanyByNormalizedDomain(executor, normalizedDomain);

      if (byDomain !== undefined) {
        return byDomain;
      }
    }

    if (normalizedDomain === null) {
      const normalizedName = normalizeCompanyName(input.candidate.name);

      if (normalizedName !== null) {
        return findCompanyByNormalizedName(executor, input.countryId, normalizedName);
      }
    }

    return undefined;
  }
}
