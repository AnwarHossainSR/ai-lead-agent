import { findCity, findIndustry } from "@mela/config";
import { BuildingIcon, FilterXIcon } from "lucide-react";
import Link from "next/link";

import { Fact } from "@/components/fact";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ListedCompany } from "@/lib/companies";
import { formatLabel } from "@/lib/format-label";

/**
 * The company list's rows, pulled out of the async server component that
 * fetches them (`companies/page.tsx`) so this rendering logic — the part
 * design D4 actually cares about, whether a failure state is distinguishable
 * from every other state — can be unit tested. jsdom cannot render an async
 * Server Component at all, so the fetch has to stay upstream of this.
 */
export function CompanyListTable({
  companies,
  filtered = false,
}: { companies: readonly ListedCompany[]; filtered?: boolean }) {
  if (companies.length === 0) {
    return filtered ? (
      <EmptyState
        variant="filtered"
        icon={<FilterXIcon />}
        title="No companies match these filters"
        description="Every company is hidden by the current filters — clearing them shows the full list."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/companies">Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<BuildingIcon />}
        title="No companies yet"
        description="A company appears once a discovery run stores one. Nothing is hidden — there is genuinely nothing here yet."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-2 font-medium">Company</th>
            <th className="px-4 py-2 font-medium">Verification</th>
            <th className="px-4 py-2 font-medium">Website Analysis</th>
            <th className="px-4 py-2 font-medium">Opportunities</th>
            <th className="px-4 py-2 font-medium">Lead</th>
            <th className="px-4 py-2 font-medium">Industry</th>
            <th className="px-4 py-2 font-medium">City</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2">
                <Link
                  href={`/companies/${company.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {company.name}
                </Link>
              </td>
              <td className="px-4 py-2">{formatLabel(company.verificationState)}</td>
              <td className="px-4 py-2">
                {company.latestAnalysis === null ? (
                  <span className="text-muted-foreground italic">Never analysed</span>
                ) : (
                  <span
                    title={company.latestAnalysis.failureReason ?? undefined}
                    className={
                      company.latestAnalysis.outcome === "completed"
                        ? undefined
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    {formatLabel(company.latestAnalysis.outcome)}
                  </span>
                )}
              </td>
              <td className="px-4 py-2">
                {company.latestOpportunityAnalysis === null ? (
                  <span className="text-muted-foreground italic">Not run</span>
                ) : (
                  <span
                    title={company.latestOpportunityAnalysis.reason ?? undefined}
                    className={
                      company.latestOpportunityAnalysis.outcome === "opportunities"
                        ? undefined
                        : "text-amber-700 dark:text-amber-400"
                    }
                  >
                    {formatLabel(company.latestOpportunityAnalysis.outcome)}
                  </span>
                )}
              </td>
              <td className="px-4 py-2">
                {company.lead === null ? (
                  <span className="text-muted-foreground italic">Not scored</span>
                ) : (
                  <Link
                    href={`/leads/${company.lead.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {company.lead.leadScore} · {formatLabel(company.lead.priority)}
                  </Link>
                )}
              </td>
              <td className="px-4 py-2">
                {findIndustry(company.industryId)?.name ?? company.industryId}
              </td>
              <td className="px-4 py-2">
                {company.cityId ? (
                  (findCity(company.cityId)?.name ?? company.cityId)
                ) : (
                  <Fact fact={{ certainty: "unknown" }} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
