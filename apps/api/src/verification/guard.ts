import type { CheckResult } from "./types";

/**
 * Enforces the "no verdict without evidence" rule.
 *
 * A passed or failed verdict without evidence is downgraded to unknown
 * with the reason "missing_evidence".  Unknown verdicts pass through
 * unchanged — they are allowed without evidence by design.
 *
 * This is the guard referenced in the spec: "A check without evidence
 * cannot report a verdict."
 */
export function enforceEvidenceRequirement(result: CheckResult): CheckResult {
  if (result.verdict === "unknown") {
    return result;
  }

  const hasEvidence = result.evidence.trim().length > 0 && result.evidenceUrl.trim().length > 0;

  if (!hasEvidence) {
    return {
      checkId: result.checkId,
      verdict: "unknown",
      evidence: `Downgraded from ${result.verdict}: no evidence provided`,
      evidenceUrl: result.evidenceUrl,
      failureCode: "missing_evidence",
    };
  }

  return result;
}
