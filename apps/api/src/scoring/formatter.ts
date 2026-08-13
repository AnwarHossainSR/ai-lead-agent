import type { ScoringResult } from "./composer";

export interface FormattedExplanation {
  readonly summary: string;
  readonly components: readonly {
    readonly id: string;
    readonly label: string;
    readonly value: number;
    readonly weight: number;
    readonly contribution: number;
    readonly reasons: readonly string[];
    readonly missing: readonly string[];
  }[];
}

const COMPONENT_LABELS: Record<string, string> = {
  business_fit: "Website Quality",
  technical_opportunity: "Technology Fit",
  business_opportunity: "Opportunity Strength",
  decision_maker_found: "Contact Reachability",
  company_quality: "Business Fit",
};

export function formatExplanation(result: ScoringResult): FormattedExplanation {
  const components = result.components.map((c) => ({
    id: c.componentId,
    label: COMPONENT_LABELS[c.componentId] ?? c.componentId,
    value: c.value,
    weight: c.weight,
    contribution: c.contribution,
    reasons: c.reasons,
    missing: c.missing,
  }));

  const lines: string[] = [
    `Total score: ${result.total}/100 (${result.priority})`,
    `Weight version: ${result.weightVersion}`,
    "",
  ];

  for (const c of components) {
    lines.push(`${c.label}: ${c.value}/${c.weight} (contribution: ${c.contribution})`);
    for (const reason of c.reasons) {
      lines.push(`  - ${reason}`);
    }
    if (c.missing.length > 0) {
      lines.push(`  Missing: ${c.missing.join(", ")}`);
    }
    lines.push("");
  }

  return {
    summary: lines.join("\n").trim(),
    components,
  };
}
