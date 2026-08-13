import { classifyPriority } from "@mela/config/product/lead-priority";
import { SCORE_COMPONENTS, getComponentRules } from "@mela/config/product/lead-scoring";
import type { CompanyEvidence } from "@mela/database";
import { getRegisteredScorers } from "./scorer";

export interface ScoringInput {
  readonly evidence: CompanyEvidence;
  readonly weightVersion: number;
}

export interface ComponentScore {
  readonly componentId: string;
  readonly value: number;
  readonly weight: number;
  readonly contribution: number;
  readonly reasons: readonly string[];
  readonly missing: readonly string[];
}

export interface ScoringResult {
  readonly total: number;
  readonly priority: "low" | "medium" | "high" | "very_high";
  readonly components: readonly ComponentScore[];
  readonly weightVersion: number;
  readonly evidenceIdentifiers: ReturnType<typeof import("@mela/database").identifyEvidence>;
}

export function composeScores(input: ScoringInput): ScoringResult {
  const scorers = getRegisteredScorers();
  const components: ComponentScore[] = [];

  for (const scorer of scorers) {
    const rules = getComponentRules(scorer.id);
    const componentConfig = SCORE_COMPONENTS.find((c) => c.id === scorer.id);
    const weight = componentConfig?.maximum ?? 0;

    const result = scorer.score(input.evidence);
    const cappedValue =
      result.missing.length > 0 ? Math.min(result.value, rules.unknownCeiling) : result.value;

    components.push({
      componentId: scorer.id,
      value: cappedValue,
      weight,
      contribution: cappedValue,
      reasons: result.reasons,
      missing: result.missing,
    });
  }

  const total = Math.min(
    100,
    Math.max(
      0,
      components.reduce((sum, c) => sum + c.contribution, 0),
    ),
  );
  const priority = classifyPriority(total);

  return {
    total,
    priority,
    components,
    weightVersion: input.weightVersion,
    evidenceIdentifiers: {} as any,
  };
}
