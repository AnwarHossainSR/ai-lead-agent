import { ConfigurationError } from "@mela/config/internal/errors";
import { SCORE_COMPONENTS } from "@mela/config/product/lead-scoring";
import type { ComponentRules } from "@mela/config/product/lead-scoring";
import type { CompanyEvidence } from "@mela/database";

/**
 * The outcome of scoring a single component.
 */
export interface ComponentResult {
  readonly value: number;
  readonly reasons: readonly string[];
  readonly missing: readonly string[];
}

/**
 * A scorer computes one component of a lead score from evidence.
 */
export interface Scorer {
  readonly id: string;
  readonly score: (evidence: CompanyEvidence, rules: ComponentRules) => ComponentResult;
}

const SCORERS: readonly Scorer[] = [];

export function registerScorer(scorer: Scorer): void {
  SCORERS.push(scorer);
}

export function getRegisteredScorers(): readonly Scorer[] {
  return SCORERS;
}

export function validateScorersMatchWeights(): void {
  const scorerIds = new Set(SCORERS.map((s) => s.id));
  const componentIds = SCORE_COMPONENTS.map((c) => c.id);

  for (const componentId of componentIds) {
    if (!scorerIds.has(componentId)) {
      throw new ConfigurationError(
        `No scorer implemented for component "${componentId}". Every configured weight must have a scorer.`,
      );
    }
  }

  for (const scorer of SCORERS) {
    if (!componentIds.includes(scorer.id)) {
      throw new ConfigurationError(
        `Scorer "${scorer.id}" has no matching weight configuration. Every scorer must have a configured weight.`,
      );
    }
  }
}
