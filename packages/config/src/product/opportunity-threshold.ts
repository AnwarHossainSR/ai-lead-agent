import { z } from "zod";
import { deepFreeze } from "../internal/freeze";
import { parseOrThrow } from "../internal/errors";

const thresholdSchema = z.object({
  minimumObservations: z
    .number()
    .int()
    .min(0, "Expected a non-negative integer."),
  minimumDetections: z
    .number()
    .int()
    .min(0, "Expected a non-negative integer."),
  requireCompletedAnalysis: z.boolean().default(false),
});

export type OpportunityThreshold = z.infer<typeof thresholdSchema>;

export function parseThresholdConfig(raw: unknown): OpportunityThreshold {
  return parseOrThrow("Opportunity threshold configuration", thresholdSchema, raw);
}

const DEFAULT_THRESHOLD = deepFreeze(
  parseThresholdConfig({
    minimumObservations: 1,
    minimumDetections: 1,
    requireCompletedAnalysis: false,
  }),
);

export { DEFAULT_THRESHOLD };