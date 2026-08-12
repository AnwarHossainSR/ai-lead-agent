import type { VerificationRule } from "@mela/config/product";

import type { CheckResult } from "./types";

/**
 * The four possible verification states for a company.
 */
export type VerificationState = "never_checked" | "verified" | "unverified" | "unreachable";

/**
 * Derives the verification state from check results and the rule.
 *
 * This is a pure, total, exported function — the same inputs always
 * produce the same output, and no code path calls a language model.
 *
 * Rules (evaluated in order):
 * 1. No checks → never_checked
 * 2. Any required check failed → unverified
 * 3. All required checks passed → verified
 * 4. Any required check unknown (and none failed) → unreachable
 * 5. Otherwise → unreachable
 */
export function deriveState(
  results: readonly CheckResult[],
  rule: VerificationRule,
): {
  state: VerificationState;
  failedCheckIds: string[];
} {
  if (results.length === 0) {
    return { state: "never_checked", failedCheckIds: [] };
  }

  const requiredCheckIds = Object.entries(rule.checks)
    .filter(([, config]) => config.required)
    .map(([id]) => id);

  const requiredResults = results.filter((r) => requiredCheckIds.includes(r.checkId));

  // 2. Any required check failed → unverified
  const failedRequired = requiredResults.filter((r) => r.verdict === "failed");
  if (failedRequired.length > 0) {
    return {
      state: "unverified",
      failedCheckIds: failedRequired.map((r) => r.checkId),
    };
  }

  // 3. All required checks passed → verified
  const allRequiredPassed =
    requiredCheckIds.length > 0 &&
    requiredCheckIds.every((id) => {
      const result = results.find((r) => r.checkId === id);
      return result?.verdict === "passed";
    });

  if (allRequiredPassed) {
    return { state: "verified", failedCheckIds: [] };
  }

  // 4 & 5. Unknown or missing required checks → unreachable
  return { state: "unreachable", failedCheckIds: [] };
}
