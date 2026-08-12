type ObservationRef = { ref: string; detail: string; url: string };
type DetectionRef = { ref: string; detail: string; url: string };
type CitedEvidence = readonly string[];
type ResolvedEvidence = { ref: string; detail: string; url: string };

/**
 * Validates that all cited evidence identifiers in an opportunity analysis output
 * exist in the original input observations/detections.
 *
 * Design D4: Unknown identifiers (refs not present in input) cause the
 * opportunity to be rejected, not silently omitted or described as unknown.
 *
 * Returns opportunities with resolved evidence references, or marks them
 * as rejected with a reason.
 */
export function validateCitedEvidence({
  output,
  observations,
  detections,
}: {
  output: {
    outcome: "opportunities";
    opportunities: readonly {
      categoryId: string;
      title: string;
      description: string;
      impact: string;
      citedEvidence: CitedEvidence;
    }[];
  };
  observations: readonly ObservationRef[];
  detections: readonly DetectionRef[];
}): {
  valid: readonly {
    categoryId: string;
    title: string;
    description: string;
    impact: string;
    citedEvidence: CitedEvidence;
    resolvedEvidence: readonly ResolvedEvidence[];
  }[];
  rejected: readonly {
    opportunity: {
      categoryId: string;
      title: string;
      description: string;
      impact: string;
      citedEvidence: CitedEvidence;
    };
    reason: string;
  }[];
} {
  const refMap: Record<string, ObservationRef | DetectionRef> = {};

  for (const obs of observations) {
    refMap[obs.ref] = obs;
  }
  for (const det of detections) {
    refMap[det.ref] = det;
  }

  const valid: {
    categoryId: string;
    title: string;
    description: string;
    impact: string;
    citedEvidence: CitedEvidence;
    resolvedEvidence: readonly ResolvedEvidence[];
  }[] = [];
  const rejected: {
    opportunity: {
      categoryId: string;
      title: string;
      description: string;
      impact: string;
      citedEvidence: CitedEvidence;
    };
    reason: string;
  }[] = [];

  for (const opp of output.opportunities) {
    const resolved: string[] = [];
    let hasInvalid = false;

    for (const ref of opp.citedEvidence) {
      const entry = refMap[ref];
      if (entry === undefined) {
        hasInvalid = true;
        break;
      }
      resolved.push(ref);
    }

    if (hasInvalid) {
      rejected.push({
        opportunity: opp,
        reason: `One or more cited evidence identifiers are not present in the input: ${opp.citedEvidence.join(", ")}`,
      });
    } else {
      valid.push({
        categoryId: opp.categoryId,
        title: opp.title,
        description: opp.description,
        impact: opp.impact,
        citedEvidence: opp.citedEvidence,
        resolvedEvidence: opp.citedEvidence.map((ref) => refMap[ref]!),
      });
    }
  }

  return { valid, rejected };
}
