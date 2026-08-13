import { CONFIGURED_TECHNOLOGIES, getComponentRules } from "@mela/config/product/lead-scoring";
import type { CompanyEvidence } from "@mela/database";
import type { ComponentResult, Scorer } from "../scorer";

export const technologyFitScorer: Scorer = {
  id: "technical_opportunity",
  score: (evidence: CompanyEvidence): ComponentResult => {
    const rules = getComponentRules("technical_opportunity");
    const detections = evidence.detections;

    if (detections.length === 0) {
      return {
        value: 0,
        reasons: [],
        missing: ["technology_detections"],
      };
    }

    const matchedTechnologies = new Set(
      detections
        .filter((d) => CONFIGURED_TECHNOLOGIES.includes(d.technologyId as any))
        .map((d) => d.technologyId),
    );

    const observedCount = detections.filter((d) => d.certainty === "observed").length;
    const inferredCount = detections.filter((d) => d.certainty === "inferred").length;

    const matchPercentage = (matchedTechnologies.size / CONFIGURED_TECHNOLOGIES.length) * 100;
    const threshold = rules.thresholds.find(
      (t) => matchPercentage >= t.minimum && matchPercentage <= t.maximum,
    );

    const reasons = [
      `${matchedTechnologies.size} of ${CONFIGURED_TECHNOLOGIES.length} configured technologies detected`,
      `${observedCount} observed, ${inferredCount} inferred`,
    ];

    return {
      value: threshold?.points ?? 0,
      reasons,
      missing: [],
    };
  },
};
