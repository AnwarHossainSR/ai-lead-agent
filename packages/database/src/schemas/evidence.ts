import { z } from "zod";

import { CERTAINTIES } from "../schema/enums";

/**
 * Zod contracts for the JSONB columns on `website_analysis`.
 *
 * JSONB has no referential integrity and no column constraints, so these
 * schemas are the only thing standing between the product principles and a
 * plausible-sounding invention. They are applied on write *and* on read
 * (design D5), because a row written by a future migration or by hand must not
 * quietly become a fact.
 *
 * The rule every schema here encodes: no claim without evidence, and no claim
 * without a certainty of `observed` or `inferred`. There is no value meaning
 * "guessed".
 */

const nonEmpty = (subject: string): z.ZodString =>
  z.string().trim().min(1, `Expected ${subject}, which may not be blank.`);

export const certaintySchema = z.enum(CERTAINTIES);

/** Where a claim came from. Required on every claim, without exception. */
export const evidenceSchema = z.object({
  /** What was actually seen — a quote, a header, a measured value. */
  detail: nonEmpty("the evidence supporting this claim"),
  /** The page it was seen on. */
  url: z.url("Expected the URL the evidence was found at."),
  /** When it was seen, as an ISO 8601 instant. */
  observedAt: z.iso.datetime({ offset: true }),
});

export type Evidence = z.infer<typeof evidenceSchema>;

/**
 * Something noticed about a website: a broken form, a missing meta
 * description, a page that takes eleven seconds to load.
 */
export const observationSchema = z.object({
  statement: nonEmpty("a statement of what was observed"),
  evidence: evidenceSchema,
  certainty: certaintySchema,
});

export type Observation = z.infer<typeof observationSchema>;

/**
 * A problem the company plausibly has, and what it appears to cost them.
 *
 * `impact` is prose, not a number: a fabricated revenue figure is exactly the
 * kind of confident nonsense this product must never produce.
 */
export const businessOpportunitySchema = z.object({
  statement: nonEmpty("a statement of the opportunity"),
  impact: nonEmpty("a description of the impact on the business"),
  evidence: evidenceSchema,
  certainty: certaintySchema,
});

export type BusinessOpportunity = z.infer<typeof businessOpportunitySchema>;

/**
 * A technology detected on the site.
 *
 * `version` is optional because it is frequently undetectable — absent means
 * unknown, and there is no default to mistake for a reading.
 */
export const technologyEvidenceSchema = z.object({
  name: nonEmpty("the name of the detected technology"),
  category: nonEmpty("the category of the detected technology"),
  version: nonEmpty("the detected version").optional(),
  evidence: evidenceSchema,
  certainty: certaintySchema,
});

export type TechnologyEvidence = z.infer<typeof technologyEvidenceSchema>;

export const observationsSchema = z.array(observationSchema);
export const businessOpportunitiesSchema = z.array(businessOpportunitySchema);
export const technologyStackSchema = z.array(technologyEvidenceSchema);
