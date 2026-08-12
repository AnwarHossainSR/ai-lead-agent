import type { RegistryConfig } from "@mela/config/product";

import type { CheckInput, CheckResult, VerificationCheck } from "../types";

/**
 * An HTTP client for registry lookups.  Injected so tests use recorded
 * fixtures, not live registries.
 */
export interface RegistryClient {
  fetch(url: string): Promise<{ status: number; body: string }>;
}

/**
 * Creates a registry check for a specific country.
 *
 * Returns unknown when no registry is configured for the company's country.
 * Returns passed/failed based on whether the company appears in the registry.
 */
export function createRegistryCheck(
  configs: readonly RegistryConfig[],
  client: RegistryClient,
): VerificationCheck {
  const configsByCountry = new Map(configs.map((c) => [c.countryId, c]));

  return {
    id: "registry",

    async run(input: CheckInput, countryId?: string): Promise<CheckResult> {
      if (!countryId) {
        return {
          checkId: "registry",
          verdict: "unknown",
          evidence: "",
          evidenceUrl: "",
          failureCode: "no_country",
        };
      }

      const config = configsByCountry.get(countryId);

      if (!config) {
        return {
          checkId: "registry",
          verdict: "unknown",
          evidence: "",
          evidenceUrl: "",
          failureCode: "no_registry",
        };
      }

      const searchUrl = `${config.baseUrl}${config.searchPath.replace("{query}", encodeURIComponent(input.companyName))}`;

      try {
        const response = await client.fetch(searchUrl);

        if (response.status !== 200) {
          return {
            checkId: "registry",
            verdict: "unknown",
            evidence: "",
            evidenceUrl: searchUrl,
            failureCode: "unusable_response",
          };
        }

        // Simple heuristic: if the company name appears in the response body,
        // consider it found.  This is deliberately weak — a real implementation
        // would parse structured data.
        const found = response.body.toLowerCase().includes(input.companyName.toLowerCase());

        if (found) {
          return {
            checkId: "registry",
            verdict: "passed",
            evidence: `Company "${input.companyName}" found in registry for ${countryId}`,
            evidenceUrl: searchUrl,
          };
        }

        return {
          checkId: "registry",
          verdict: "failed",
          evidence: `Company "${input.companyName}" not found in registry for ${countryId}`,
          evidenceUrl: searchUrl,
        };
      } catch {
        return {
          checkId: "registry",
          verdict: "unknown",
          evidence: "",
          evidenceUrl: searchUrl,
          failureCode: "unusable_response",
        };
      }
    },
  };
}
