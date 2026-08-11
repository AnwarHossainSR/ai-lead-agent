import { z } from "zod";

import { assertUniqueIdentifiers, ConfigurationError, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";

/** Lead scores are whole numbers on this scale, inclusive at both ends. */
export const MINIMUM_LEAD_SCORE = 0;
export const MAXIMUM_LEAD_SCORE = 100;

const SUBJECT = "Lead priority configuration";

export const priorityBandSchema = z
  .object({
    id: identifierSchema,
    name: displayNameSchema,
    minimum: z.number().int().min(MINIMUM_LEAD_SCORE).max(MAXIMUM_LEAD_SCORE),
    maximum: z.number().int().min(MINIMUM_LEAD_SCORE).max(MAXIMUM_LEAD_SCORE),
  })
  .refine((band) => band.minimum <= band.maximum, {
    message: "A band's minimum must not exceed its maximum.",
  });

export type PriorityBand = z.infer<typeof priorityBandSchema>;

/**
 * Validates that the bands tile 0–100 exactly: sorted by minimum, the first
 * starts at 0, the last ends at 100, and each subsequent band starts one point
 * above the previous one's maximum. A gap would leave a score unclassifiable;
 * an overlap would make classification depend on declaration order.
 */
export function parsePriorityBands(raw: unknown): readonly PriorityBand[] {
  const bands = parseOrThrow(SUBJECT, z.array(priorityBandSchema).min(1), raw);

  assertUniqueIdentifiers(
    SUBJECT,
    bands.map((band) => band.id),
  );

  const sorted = [...bands].sort((left, right) => left.minimum - right.minimum);
  let expectedStart = MINIMUM_LEAD_SCORE;

  for (const band of sorted) {
    if (band.minimum < expectedStart) {
      throw new ConfigurationError(
        SUBJECT,
        `Band "${band.id}" starts at ${band.minimum}, overlapping the band that ends at ${expectedStart - 1}.`,
      );
    }

    if (band.minimum > expectedStart) {
      throw new ConfigurationError(
        SUBJECT,
        `No band covers scores ${expectedStart} to ${band.minimum - 1}.`,
      );
    }

    expectedStart = band.maximum + 1;
  }

  if (expectedStart !== MAXIMUM_LEAD_SCORE + 1) {
    throw new ConfigurationError(
      SUBJECT,
      `No band covers scores ${expectedStart} to ${MAXIMUM_LEAD_SCORE}.`,
    );
  }

  return deepFreeze(sorted);
}

const PRIORITY_BAND_DATA = [
  { id: "very_high", name: "Very High", minimum: 90, maximum: 100 },
  { id: "high", name: "High", minimum: 80, maximum: 89 },
  { id: "medium", name: "Medium", minimum: 70, maximum: 79 },
  { id: "low", name: "Low", minimum: 0, maximum: 69 },
] as const;

/** Sorted ascending by minimum, so `low` comes first. */
export const PRIORITY_BANDS = parsePriorityBands(PRIORITY_BAND_DATA);

export type LeadPriority = (typeof PRIORITY_BAND_DATA)[number]["id"];

export const LEAD_PRIORITIES = deepFreeze(
  PRIORITY_BAND_DATA.map((band) => band.id),
) as readonly LeadPriority[];

export function findPriorityBand(id: string): PriorityBand | undefined {
  return PRIORITY_BANDS.find((band) => band.id === id);
}

/**
 * Maps a lead score to its priority band. Non-integer and out-of-range scores
 * are refused: the bands are integer ranges, so 89.5 has no defined band and
 * silently rounding it would invent a classification.
 */
export function classifyPriority(score: number): LeadPriority {
  if (!Number.isInteger(score)) {
    throw new ConfigurationError(
      SUBJECT,
      `Cannot classify score ${String(score)}. Expected a whole number between ${MINIMUM_LEAD_SCORE} and ${MAXIMUM_LEAD_SCORE}.`,
    );
  }

  if (score < MINIMUM_LEAD_SCORE || score > MAXIMUM_LEAD_SCORE) {
    throw new ConfigurationError(
      SUBJECT,
      `Cannot classify score ${score}. Valid range is ${MINIMUM_LEAD_SCORE} to ${MAXIMUM_LEAD_SCORE} inclusive.`,
    );
  }

  const band = PRIORITY_BANDS.find(
    (candidate) => score >= candidate.minimum && score <= candidate.maximum,
  );

  if (band === undefined) {
    // Unreachable while parsePriorityBands guarantees full coverage; kept so a
    // future change that breaks that guarantee fails loudly instead of
    // returning a fabricated priority.
    throw new ConfigurationError(SUBJECT, `No band covers score ${score}.`);
  }

  return band.id as LeadPriority;
}
