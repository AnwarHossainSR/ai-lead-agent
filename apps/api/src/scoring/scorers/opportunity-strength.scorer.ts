import { getComponentRules } from "@mela/config/product/lead-scoring";
import type { CompanyEvidence } from "@mela/database";
import type { ComponentResult, Scorer } from "../scorer";

export const opportunityStrengthScorer: Scorer = {
  id: "business_opportunity",
  score: (evidence: CompanyEvidence): ComponentResult => {
    const rules = getComponentRules("business_opportunity");
    const opportunities = evidence.opportunities;

    if (opportunities.length === 0) {
      return {
        value: 0,
        reasons: [],
        missing: ["opportunities"],
      };
    }

    const normalizedCount = opportunities.length >= 3 ? 100 : (opportunities.length / 3) * 100;
    const threshold = rules.thresholds.find(
      (t) => normalizedCount >= t.minimum && normalizedCount <= t.maximum,
    );

    const reasons = [
      `${opportunities.length} accepted opportunity${opportunities.length === 1 ? "" : "s"}`,
      ...opportunities.map((o) => o.title),
    ];

    return {
      value: threshold?.points ?? 0,
      reasons,
      missing: [],
    };
  },
};
