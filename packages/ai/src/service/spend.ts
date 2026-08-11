import { resolveAIModelTier, type AIModelTier } from "@mela/config";

import type { AITokenUsage } from "../provider/provider";

/**
 * Cost estimation from token counts and configured prices (design D6/D7).
 * The result is always an estimate — the column is named
 * `estimated_cost_usd` for exactly this reason.
 */

export interface CostEstimate {
  readonly estimatedCostUsd: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Estimates the cost of a call from its token counts and the tier's
 * configured per-million-token prices.
 */
export function estimateCost(
  tierId: string,
  usage: AITokenUsage,
): CostEstimate {
  const tier = resolveAIModelTier(tierId);
  const inputCost =
    (usage.inputTokens / 1_000_000) * tier.inputPricePerMillionTokensUsd;
  const outputCost =
    (usage.outputTokens / 1_000_000) * tier.outputPricePerMillionTokensUsd;

  return {
    estimatedCostUsd: inputCost + outputCost,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };
}

/**
 * The model identifier for a tier. Used in invocation records and log
 * output (design D6).
 */
export function modelForTier(tierId: string): string {
  return resolveAIModelTier(tierId).modelId;
}

/**
 * Resolves the tier, throwing if the ID is not configured.
 */
export function resolveTier(tierId: string): AIModelTier {
  return resolveAIModelTier(tierId);
}
