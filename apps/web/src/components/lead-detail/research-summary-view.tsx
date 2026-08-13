import { Fact } from "@/components/fact";
import { Generated } from "@/components/generated";
import type { ResearchSummary } from "@/lib/lead-detail";

const SECTION_LABELS: readonly { key: string; label: string }[] = [
  { key: "business", label: "Business" },
  { key: "webPresence", label: "Web Presence" },
  { key: "opportunities", label: "Opportunities" },
  { key: "people", label: "People" },
  { key: "approach", label: "Suggested Approach" },
];

/**
 * Renders a research summary's sections and derived unknown-facts list
 * through `<Generated>` (design D2) — the whole thing is model output, so
 * the label stays attached to it for as long as it's on the page.
 */
export function ResearchSummaryView({ summary }: { summary: ResearchSummary | null }) {
  if (summary === null) {
    return <p className="text-sm text-muted-foreground">No research summary generated yet.</p>;
  }

  const sections = SECTION_LABELS.filter(({ key }) => (summary.sections[key]?.length ?? 0) > 0);

  return (
    <Generated>
      <div className="space-y-4">
        {sections.map(({ key, label }) => (
          <div key={key}>
            <h3 className="text-sm font-medium">{label}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {summary.sections[key]?.map((claim) => (
                <li key={claim.text} className="text-sm text-muted-foreground">
                  {claim.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {summary.unknownFacts.length > 0 && (
          <div>
            <h3 className="text-sm font-medium">Not established</h3>
            <ul className="mt-1 space-y-1">
              {summary.unknownFacts.map((fact) => (
                <li key={fact} className="text-sm">
                  {fact}: <Fact fact={{ certainty: "unknown" }} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Generated>
  );
}
