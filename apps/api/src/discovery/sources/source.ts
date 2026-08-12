import { z } from "zod";

/**
 * What a discovery source is asked to find (design D2). Territory identifiers
 * are the configured ones from `@mela/config`, validated by the run service
 * before any source is asked for anything.
 */
export interface DiscoveryRequest {
  readonly countryId: string;
  readonly cityId?: string;
  readonly industryId: string;
}

/**
 * One company a source claims exists (design D2).
 *
 * `sourceUrl` is required — it is where the claim can be inspected, and a
 * candidate that cannot say where it was found is structurally impossible to
 * express. Every other attribute is optional and is stored as absent when the
 * source does not state it: never an empty string, never a guess, never a
 * constructed URL.
 */
export interface DiscoveredCandidate {
  readonly name: string;
  readonly sourceUrl: string;
  readonly website?: string;
  readonly city?: string;
  readonly companySize?: string;
  readonly linkedinUrl?: string;
  readonly description?: string;
}

/**
 * The successful answer from a source: candidates it vouches for, and the
 * rows it rejected with a count per reason. Empty candidates is a real
 * outcome — a source that found nothing is not a failed source.
 */
export interface DiscoverySourceSuccess {
  readonly outcome: "succeeded";
  readonly candidates: readonly DiscoveredCandidate[];
  readonly rejections: readonly { readonly reason: string; readonly count: number }[];
}

/**
 * How one source answered a request. The `succeeded` branch carries its
 * rejections so the run can record *why* rows were dropped, not just how many.
 */
export type DiscoverySourceResult =
  | DiscoverySourceSuccess
  | { readonly outcome: "blocked"; readonly note: string }
  | { readonly outcome: "failed"; readonly reason: string };

/**
 * A source of candidate companies. Implementations are the only code allowed
 * to know how a particular source answers; everything above them sees
 * `DiscoverySourceResult`.
 */
export interface DiscoverySource {
  readonly sourceId: string;
  fetch(request: DiscoveryRequest): Promise<DiscoverySourceResult>;
}

/**
 * The rejections a run can be told about. Coarse on purpose: the run records
 * a count per reason, and two reasons say everything that matters here — the
 * claim was untraceable, or the source said something that is not a candidate.
 */
export const CANDIDATE_REJECTION_REASONS = {
  missing_source_url: "missing_source_url",
  invalid_candidate: "invalid_candidate",
} as const;

export type CandidateRejectionReason =
  (typeof CANDIDATE_REJECTION_REASONS)[keyof typeof CANDIDATE_REJECTION_REASONS];

/**
 * A blank or null optional value is the same as one that was never supplied:
 * "no company size known" and "no company size field in the file" are the same
 * fact. Stored as absent, never as an empty string.
 */
const optionalFact = z.preprocess((value) => {
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }
  if (value === null) {
    return undefined;
  }
  return value;
}, z
  .string()
  .trim()
  .min(1, "Expected a value or nothing at all; a blank string is not a fact.")
  .optional());

/**
 * A candidate as it arrives from an adapter — the boundary schema (design D2).
 * An adapter is code we wrote, but it is also the thing most likely to be
 * wrong, so nothing from one is trusted before it passes here.
 */
export const discoveredCandidateSchema = z.object({
  name: z.string().trim().min(1, "Expected the company name."),
  sourceUrl: z.url("Expected the URL this company was found at."),
  website: optionalFact,
  city: optionalFact,
  companySize: optionalFact,
  linkedinUrl: optionalFact,
  description: optionalFact,
});

export type CandidateValidation =
  | { readonly ok: true; readonly candidate: DiscoveredCandidate }
  | { readonly ok: false; readonly reason: CandidateRejectionReason };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates a raw candidate at the adapter boundary. A missing or blank source
 * URL gets its own named reason; anything else that fails the schema is
 * `invalid_candidate`. Nothing guessed is ever returned.
 */
export function validateCandidate(input: unknown): CandidateValidation {
  if (!isRecord(input)) {
    return { ok: false, reason: CANDIDATE_REJECTION_REASONS.invalid_candidate };
  }

  if (typeof input.sourceUrl !== "string" || input.sourceUrl.trim().length === 0) {
    return { ok: false, reason: CANDIDATE_REJECTION_REASONS.missing_source_url };
  }

  const result = discoveredCandidateSchema.safeParse(input);

  if (!result.success) {
    return { ok: false, reason: CANDIDATE_REJECTION_REASONS.invalid_candidate };
  }

  return { ok: true, candidate: result.data };
}
