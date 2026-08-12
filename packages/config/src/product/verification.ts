import { z } from "zod";

import { assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";

/**
 * The check identifiers the system implements. A rule naming an unknown check
 * fails at load.
 */
const CHECK_IDENTIFIERS = ["dns", "http", "domain-name-match", "registry"] as const;

export type VerificationCheckId = (typeof CHECK_IDENTIFIERS)[number];

export function isVerificationCheckId(id: string): boolean {
  return (CHECK_IDENTIFIERS as readonly string[]).includes(id);
}

/**
 * Per-check configuration within the verification rule.
 */
export const verificationCheckConfigSchema = z.object({
  required: z.boolean(),
  sufficient: z.boolean(),
  timeoutMs: z.number().int().min(0, "Expected a non-negative timeout."),
});

export type VerificationCheckConfig = z.infer<typeof verificationCheckConfigSchema>;

/**
 * The verification rule: which checks exist, which are required, which are
 * sufficient, their timeouts, and the staleness window.
 */
export const verificationRuleSchema = z
  .object({
    checks: z.record(z.string(), verificationCheckConfigSchema),
    stalenessDays: z.number().int().positive("Expected a positive staleness window."),
  })
  .superRefine((data, ctx) => {
    // All check identifiers must be known
    const unknownChecks = Object.keys(data.checks).filter((id) => !isVerificationCheckId(id));
    if (unknownChecks.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown verification check(s): ${unknownChecks.join(", ")}. Implemented checks: ${CHECK_IDENTIFIERS.join(", ")}.`,
        path: ["checks"],
      });
    }

    // At least one check must be required
    const hasRequired = Object.values(data.checks).some((config) => config.required);
    if (!hasRequired) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one verification check must be required.",
        path: ["checks"],
      });
    }
  });

export type VerificationRule = z.infer<typeof verificationRuleSchema>;

/**
 * Per-host politeness configuration for verification requests.
 */
export const verificationPolitenessSchema = z.object({
  /** Minimum interval between requests to the same host, in milliseconds. */
  minRequestIntervalMs: z.number().int().positive("Expected a positive request interval."),
  /** Maximum requests per company verification pass. */
  maxRequestsPerCompany: z.number().int().positive("Expected a positive request limit."),
  /** Maximum concurrent requests to a single host. */
  batchConcurrency: z.number().int().positive("Expected a positive concurrency limit."),
});

export type VerificationPoliteness = z.infer<typeof verificationPolitenessSchema>;

/**
 * Validates the verification rule configuration.
 */
export function parseVerificationRule(raw: unknown): VerificationRule {
  return parseOrThrow("Verification rule", verificationRuleSchema, raw);
}

/**
 * Validates that the rule doesn't require `registry` when no registries
 * are configured.  Call this after loading both the rule and the registry
 * configs.
 */
export function validateRegistryRequirement(
  rule: VerificationRule,
  registryConfigs: readonly RegistryConfig[],
): void {
  const registryCheck = rule.checks.registry;
  if (registryCheck?.required && registryConfigs.length === 0) {
    throw new Error(
      "Cannot make the 'registry' check required: no registries are configured. " +
        "Either configure at least one country registry or set registry.required to false.",
    );
  }
}

/**
 * Validates the verification politeness configuration.
 */
export function parseVerificationPoliteness(raw: unknown): VerificationPoliteness {
  return parseOrThrow("Verification politeness", verificationPolitenessSchema, raw);
}

/**
 * The default verification rule for UAE and Saudi Arabia.
 *
 * - `dns` and `http` are required: a company that cannot be reached is unverified.
 * - `domain-name-match` is optional and never required (a real company can trade
 *   on a domain that looks nothing like its name).
 * - `registry` is optional and configured per country.
 * - `stalenessDays` is 90: a company verified a year ago is not treated as
 *   verified today.
 */
const VERIFICATION_RULE_DATA = {
  checks: {
    dns: { required: true, sufficient: false, timeoutMs: 5_000 },
    http: { required: true, sufficient: false, timeoutMs: 10_000 },
    "domain-name-match": { required: false, sufficient: false, timeoutMs: 0 },
    registry: { required: false, sufficient: false, timeoutMs: 15_000 },
  },
  stalenessDays: 90,
} as const;

const VERIFICATION_POLITENESS_DATA = {
  minRequestIntervalMs: 1_000,
  maxRequestsPerCompany: 10,
  batchConcurrency: 4,
} as const;

export const VERIFICATION_RULE = deepFreeze(parseVerificationRule(VERIFICATION_RULE_DATA));
export const VERIFICATION_POLITENESS = deepFreeze(
  parseVerificationPoliteness(VERIFICATION_POLITENESS_DATA),
);

/**
 * Per-country registry configuration for the registry check.
 * Absent where no usable public registry exists.
 */
export const registryConfigSchema = z.object({
  /** The country this registry covers. */
  countryId: z.string().trim().min(1),
  /** Base URL for registry lookups. */
  baseUrl: z.string().url(),
  /** Search path template. The `{query}` placeholder is replaced with the search term. */
  searchPath: z.string().trim().min(1),
});

export type RegistryConfig = z.infer<typeof registryConfigSchema>;

/**
 * Validates the registry configurations.
 */
export function parseRegistryConfigs(raw: unknown): readonly RegistryConfig[] {
  const configs = parseOrThrow("Registry configuration", z.array(registryConfigSchema), raw);

  assertUniqueIdentifiers(
    "Registry configuration",
    configs.map((config) => config.countryId),
  );

  return deepFreeze(configs);
}

/**
 * Default registry configuration. Currently empty — no public registry is
 * configured for UAE or Saudi Arabia.
 */
const REGISTRY_CONFIG_DATA: readonly RegistryConfig[] = [];

export const REGISTRY_CONFIGS = parseRegistryConfigs(REGISTRY_CONFIG_DATA);
