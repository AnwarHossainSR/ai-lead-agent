import { z } from "zod";

import { deepFreeze } from "../internal/freeze";
import { parseOrThrow } from "../internal/errors";

/**
 * A viewport configuration for browser capture.
 */
export const viewportSchema = z.object({
  name: z.string().min(1, "Expected a viewport name."),
  width: z.number().int().positive("Expected a positive width."),
  height: z.number().int().positive("Expected a positive height."),
});

export type Viewport = z.infer<typeof viewportSchema>;

/**
 * An observation rule that checks a page capture for issues.
 */
export const observationRuleSchema = z.object({
  id: z.string().min(1, "Expected a rule identifier."),
  threshold: z
    .number()
    .int()
    .min(0, "Expected a threshold between 0 and 100.")
    .max(100, "Expected a threshold between 0 and 100."),
});

export type ObservationRule = z.infer<typeof observationRuleSchema>;

/**
 * The analysis configuration: viewports, extra paths, observation rules,
 * and staleness window.
 */
export const analysisConfigSchema = z.object({
  viewports: z.array(viewportSchema).min(1, "At least one viewport is required."),
  extraPaths: z.array(
    z
      .string()
      .min(1)
      .refine((p) => p.startsWith("/"), "Extra paths must be relative and start with /."),
  ),
  observationRules: z.array(observationRuleSchema),
  stalenessDays: z
    .number()
    .int()
    .positive("Expected a positive staleness window."),
});

export type AnalysisConfig = z.infer<typeof analysisConfigSchema>;

/**
 * Parses and validates an analysis configuration, throwing on invalid input.
 */
export function parseAnalysisConfig(input: unknown): AnalysisConfig {
  return parseOrThrow("The analysis configuration", analysisConfigSchema, input);
}

/**
 * The default analysis configuration.
 *
 * - Two viewports: desktop (1920×1080) and mobile (375×812)
 * - Extra paths to try after the root: /about, /contact
 * - Observation rules with thresholds
 * - 30-day staleness window
 */
export const ANALYSIS_CONFIG = deepFreeze(
  parseAnalysisConfig({
    viewports: [
      { name: "desktop", width: 1920, height: 1080 },
      { name: "mobile", width: 375, height: 812 },
    ],
    extraPaths: ["/about", "/contact"],
    observationRules: [
      { id: "no-https", threshold: 100 },
      { id: "invalid-certificate", threshold: 100 },
      { id: "missing-viewport-meta", threshold: 100 },
      { id: "render-blocking-resources", threshold: 100 },
      { id: "console-errors", threshold: 100 },
      { id: "failed-requests", threshold: 100 },
      { id: "missing-title", threshold: 100 },
      { id: "missing-meta-description", threshold: 100 },
      { id: "missing-favicon", threshold: 100 },
      { id: "mixed-content", threshold: 100 },
      { id: "excessive-page-weight", threshold: 100 },
    ],
    stalenessDays: 30,
  }),
);
