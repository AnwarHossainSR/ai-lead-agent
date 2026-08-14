import { Evidence } from "@/components/evidence";
import { formatLabel } from "@/lib/format-label";
import type { OpportunityWithEvidence } from "@/lib/lead-detail";

/**
 * Renders opportunities with their cited evidence (design D2). A citation
 * that resolved to a source links through `<Evidence>`; one that didn't
 * renders as an explicit unknown rather than being silently dropped.
 */
export function OpportunityList({
  opportunities,
}: { opportunities: readonly OpportunityWithEvidence[] }) {
  if (opportunities.length === 0) {
    return <p className="text-sm text-muted-foreground">No opportunities identified.</p>;
  }

  return (
    <ul className="space-y-4">
      {opportunities.map((opportunity) => (
        <li key={opportunity.id} className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">{opportunity.title}</h3>
            <span className="text-xs text-muted-foreground uppercase">
              {formatLabel(opportunity.certainty)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{opportunity.description}</p>
          <p className="mt-1 text-sm">
            <span className="font-medium">Impact: </span>
            {opportunity.impact}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {opportunity.resolvedEvidence.map((evidence, index) =>
              evidence.url ? (
                <Evidence
                  key={`${evidence.ref}-${index}`}
                  sourceUrl={evidence.url}
                  recordedAt={opportunity.createdAt}
                  detail={evidence.detail}
                  className="text-xs"
                >
                  Cited evidence {index + 1}
                </Evidence>
              ) : (
                <span
                  key={`${evidence.ref}-${index}`}
                  title={evidence.detail}
                  className="text-xs text-muted-foreground italic"
                >
                  Cited evidence {index + 1}: unknown
                </span>
              ),
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
