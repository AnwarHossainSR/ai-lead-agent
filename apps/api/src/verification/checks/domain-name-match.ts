import type { CheckInput, CheckResult, VerificationCheck } from "../types";

/**
 * Tokenize a string by splitting on non-alphanumeric characters and
 * returning lowercase tokens of length >= 2.
 */
function tokenize(s: string): Set<string> {
  const tokens = new Set<string>();
  for (const part of s.toLowerCase().split(/[^a-z0-9]+/)) {
    if (part.length >= 2) {
      tokens.add(part);
    }
  }
  return tokens;
}

/**
 * The domain-name-match check compares the company name against the
 * domain label using simple token overlap.  It is deliberately weak
 * and deliberately never required — it can only ever contribute,
 * because a real company can trade on a domain that looks nothing
 * like its name.
 *
 * No network request, no model, no fuzzy library — just a
 * deterministic token-overlap comparison over normalized values.
 */
export function createDomainNameMatchCheck(): VerificationCheck {
  return {
    id: "domain-name-match",

    async run(input: CheckInput): Promise<CheckResult> {
      const { companyName, domain } = input;

      // Extract the registrable domain label (before the first dot)
      const label = domain.split(".")[0] ?? domain;

      const nameTokens = tokenize(companyName);
      const domainTokens = tokenize(label);

      const overlap: string[] = [];
      for (const token of nameTokens) {
        if (domainTokens.has(token)) {
          overlap.push(token);
        }
      }

      const evidenceUrl = `domain-name-match:${domain}`;

      if (overlap.length > 0) {
        return {
          checkId: "domain-name-match",
          verdict: "passed",
          evidence: `Tokens match: [${overlap.join(", ")}] between "${companyName}" and "${label}"`,
          evidenceUrl,
        };
      }

      return {
        checkId: "domain-name-match",
        verdict: "failed",
        evidence: `No overlapping tokens between "${companyName}" and "${label}"`,
        evidenceUrl,
      };
    },
  };
}

