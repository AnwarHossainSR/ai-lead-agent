import { getComponentRules } from "@mela/config/product/lead-scoring";
import type { CompanyEvidence } from "@mela/database";
import type { ComponentResult, Scorer } from "../scorer";

export const websiteQualityScorer: Scorer = {
  id: "business_fit",
  score: (evidence: CompanyEvidence): ComponentResult => {
    const rules = getComponentRules("business_fit");
    const analysis = evidence.analysis;

    if (analysis === undefined) {
      return {
        value: 0,
        reasons: [],
        missing: ["website_analysis"],
      };
    }

    const scores = [
      analysis.performanceScore,
      analysis.accessibilityScore,
      analysis.seoScore,
      analysis.mobileScore,
      analysis.uxScore,
    ].filter((score): score is number => score !== null && score !== undefined);

    const missing: string[] = [];
    if (analysis.performanceScore === null || analysis.performanceScore === undefined)
      missing.push("performance_score");
    if (analysis.accessibilityScore === null || analysis.accessibilityScore === undefined)
      missing.push("accessibility_score");
    if (analysis.seoScore === null || analysis.seoScore === undefined) missing.push("seo_score");
    if (analysis.mobileScore === null || analysis.mobileScore === undefined)
      missing.push("mobile_score");
    if (analysis.uxScore === null || analysis.uxScore === undefined) missing.push("ux_score");

    const observations = analysis.observations ?? [];
    if (observations.length === 0) {
      missing.push("observations");
    }

    if (scores.length === 0) {
      return {
        value: 0,
        reasons: [],
        missing: [...missing, "lighthouse_scores"],
      };
    }

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const threshold = rules.thresholds.find((t) => average >= t.minimum && average <= t.maximum);

    const reasons = [
      `Lighthouse average ${average.toFixed(1)} across ${scores.length} measured scores`,
      ...observations.map((o) => o.statement),
    ];

    return {
      value: threshold?.points ?? 0,
      reasons,
      missing,
    };
  },
};
