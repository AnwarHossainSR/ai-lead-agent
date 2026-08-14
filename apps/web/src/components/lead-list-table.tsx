import { findCity, findIndustry } from "@mela/config";
import { FilterXIcon, TargetIcon } from "lucide-react";
import Link from "next/link";

import { Fact } from "@/components/fact";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatLabel } from "@/lib/format-label";
import type { ListedLead } from "@/lib/leads";

/**
 * Pure presentational — takes leads already fetched (design pattern from
 * task 6.4's `CompanyListTable`) so it renders in jsdom without a server
 * round trip, which is what makes it testable at all.
 */
export function LeadListTable({
  leads,
  filtered = false,
}: { leads: readonly ListedLead[]; filtered?: boolean }) {
  if (leads.length === 0) {
    return filtered ? (
      <EmptyState
        variant="filtered"
        icon={<FilterXIcon />}
        title="No leads match these filters"
        description="Every lead is hidden by the current filters — clearing them shows the full list."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/leads">Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<TargetIcon />}
        title="No leads yet"
        description="A lead appears once a discovered company has been scored. Nothing is hidden — there is genuinely nothing here yet."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-2 font-medium">Company</th>
            <th className="px-4 py-2 font-medium">Score</th>
            <th className="px-4 py-2 font-medium">Priority</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Industry</th>
            <th className="px-4 py-2 font-medium">City</th>
            <th className="px-4 py-2 font-medium">Staleness</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2">
                <Link
                  href={`/leads/${lead.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {lead.companyName}
                </Link>
              </td>
              <td className="px-4 py-2">{lead.leadScore}</td>
              <td className="px-4 py-2">{formatLabel(lead.priority)}</td>
              <td className="px-4 py-2">{formatLabel(lead.status)}</td>
              <td className="px-4 py-2">
                {findIndustry(lead.industryId)?.name ?? lead.industryId}
              </td>
              <td className="px-4 py-2">
                {lead.cityId ? (
                  (findCity(lead.cityId)?.name ?? lead.cityId)
                ) : (
                  <Fact fact={{ certainty: "unknown" }} />
                )}
              </td>
              <td className="px-4 py-2">
                {lead.isStale ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Stale
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Fresh</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
