import { z } from "zod";

import { assertUniqueIdentifiers, ConfigurationError, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { identifierSchema } from "../internal/identifier";

const SUBJECT = "AI model tier configuration";

/**
 * A prompt declares which tier it needs (design D3): `default` for evidence-
 * weighted reasoning, `fast` for cheap classification. Prices are
 * configuration, not a constant, because a vendor changes them and a
 * hardcoded number would be silently wrong the day they do.
 */
export const aiModelTierSchema = z.object({
  id: identifierSchema,
  modelId: z.string().trim().min(1, "Expected a model identifier."),
  inputPricePerMillionTokensUsd: z.number().positive(),
  outputPricePerMillionTokensUsd: z.number().positive(),
});

export type AIModelTier = z.infer<typeof aiModelTierSchema>;

export function parseAIModelTiers(raw: unknown): readonly AIModelTier[] {
  const tiers = parseOrThrow(SUBJECT, z.array(aiModelTierSchema).min(1), raw);

  assertUniqueIdentifiers(
    SUBJECT,
    tiers.map((tier) => tier.id),
  );

  return deepFreeze(tiers);
}

const AI_MODEL_TIER_DATA = [
  {
    id: "default",
    modelId: "claude-sonnet-5",
    inputPricePerMillionTokensUsd: 3,
    outputPricePerMillionTokensUsd: 15,
  },
  {
    id: "fast",
    modelId: "claude-haiku-4-5-20251001",
    inputPricePerMillionTokensUsd: 1,
    outputPricePerMillionTokensUsd: 5,
  },
] as const;

export const AI_MODEL_TIERS = parseAIModelTiers(AI_MODEL_TIER_DATA);

export type AIModelTierId = (typeof AI_MODEL_TIER_DATA)[number]["id"];

export function findAIModelTier(id: string): AIModelTier | undefined {
  return AI_MODEL_TIERS.find((tier) => tier.id === id);
}

export function resolveAIModelTier(id: string): AIModelTier {
  const tier = findAIModelTier(id);

  if (tier === undefined) {
    const known = AI_MODEL_TIERS.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      SUBJECT,
      `Unknown AI model tier "${id}". Configured tiers: ${known}.`,
    );
  }

  return tier;
}
