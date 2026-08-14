import { Evidence } from "@/components/evidence";
import { formatLabel } from "@/lib/format-label";
import type { OutreachClaim } from "@/lib/outreach";

/**
 * Renders the claims a drafted message makes, each with the citations
 * behind it (design D3: the reviewer is answering "is this true"). A
 * citation with a resolved source links through `<Evidence>` with its
 * certainty; one that couldn't be resolved renders the reason explicitly
 * rather than as if it were a real fact.
 */
export function CitedFactsPanel({
  claims,
  recordedAt,
}: {
  claims: readonly OutreachClaim[];
  recordedAt: string;
}) {
  if (claims.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No cited facts recorded for this message.</p>
    );
  }

  return (
    <ul className="space-y-4">
      {claims.map((claim) => (
        <li key={claim.text}>
          <p className="text-sm font-medium">{claim.text}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {claim.citations.map((citation, index) =>
              citation.url ? (
                <Evidence
                  key={`${citation.ref}-${index}`}
                  sourceUrl={citation.url}
                  recordedAt={recordedAt}
                  detail={citation.detail}
                  className="text-xs"
                >
                  {citation.certainty ? formatLabel(citation.certainty) : "Source"}
                </Evidence>
              ) : (
                <span
                  key={`${citation.ref}-${index}`}
                  className="text-xs text-muted-foreground italic"
                >
                  {citation.detail}
                </span>
              ),
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
