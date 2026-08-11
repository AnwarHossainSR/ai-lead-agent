import { z } from "zod";

import { assertUniqueIdentifiers, ConfigurationError, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { identifierSchema } from "../internal/identifier";

const SUBJECT = "AI model tier configuration";

/**
 * A prompt declares which tier it needs (design D3): `default` for evidence-
 * weighted reasoning, `fast` for cheap classification. The two tiers are
 * served by two different vendors — Gemini and Cloudflare Workers AI — not
 * one vendor selected at runtime, so each tier names its own vendor. Prices
 * are configuration, not a constant, because a vendor changes them and a
 * hardcoded number would be silently wrong the day they do.
 */
export const aiModelTierSchema = z.object({
  id: identifierSchema,
  vendor: z.enum(["gemini", "cloudflare-workers-ai"]),
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

// Prices are approximate, sourced from each vendor's published rate card at
// time of writing. They drift — that is exactly what estimated_cost_usd
// (design D6) is named for. Update here when a vendor changes theirs.
const AI_MODEL_TIER_DATA = [
  {
    id: "default",
    vendor: "gemini",
    modelId: "gemini-2.5-pro",
    inputPricePerMillionTokensUsd: 1.25,
    outputPricePerMillionTokensUsd: 10,
  },
  {
    id: "fast",
    vendor: "cloudflare-workers-ai",
    modelId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    inputPricePerMillionTokensUsd: 0.29,
    outputPricePerMillionTokensUsd: 2.25,
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
