import type { InsertAccountInput } from "../write/accounts";
import type { InsertAIInvocationInput } from "../write/ai-invocations";
import type { InsertCompanyInput } from "../write/companies";
import type { InsertContactInput } from "../write/contacts";
import type { InsertLeadInput } from "../write/leads";

/**
 * Valid inputs for tests to start from.
 *
 * Each returns the minimum that is *accepted*, so a test that overrides one
 * field is testing that field and nothing else. Nothing here is realistic
 * data: every value is obviously an example.
 */

export function companyInput(overrides: Partial<InsertCompanyInput> = {}): InsertCompanyInput {
  return {
    name: "Example Trading L.L.C.",
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    discoverySource: "test fixture",
    discoverySourceUrl: "https://example.com/fixture",
    ...overrides,
  };
}

export function contactInput(
  companyId: string,
  overrides: Partial<InsertContactInput> = {},
): InsertContactInput {
  return {
    companyId,
    name: "Example Contact",
    certainty: "observed",
    extractionMethod: "deterministic",
    researchSource: "test fixture",
    ...overrides,
  };
}

export function aiInvocationInput(
  overrides: Partial<InsertAIInvocationInput> = {},
): InsertAIInvocationInput {
  return {
    promptName: "test_prompt",
    promptVersion: 1,
    model: "gemini-2.5-pro",
    tier: "default",
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostUsd: 0.001,
    latencyMs: 250,
    attempts: 1,
    outcome: "succeeded",
    ...overrides,
  };
}

let accountFixtureCount = 0;

/** A fake, argon2id-shaped hash — long enough to look real, never checkable against any password. */
const FIXTURE_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$dGVzdC1maXh0dXJlLXNhbHQ$dGVzdC1maXh0dXJlLWhhc2gtbm90LXJlYWw";

export function accountInput(overrides: Partial<InsertAccountInput> = {}): InsertAccountInput {
  accountFixtureCount += 1;

  return {
    email: `fixture-account-${accountFixtureCount}@example.com`,
    passwordHash: FIXTURE_PASSWORD_HASH,
    role: "operator",
    ...overrides,
  };
}

export function leadInput(
  companyId: string,
  overrides: Partial<InsertLeadInput> = {},
): InsertLeadInput {
  return {
    companyId,
    scores: {
      business_fit: 25,
      technical_opportunity: 25,
      business_opportunity: 15,
      decision_maker_found: 10,
      company_quality: 8,
    },
    scoreExplanation: "Example explanation for a test fixture.",
    ...overrides,
  };
}
