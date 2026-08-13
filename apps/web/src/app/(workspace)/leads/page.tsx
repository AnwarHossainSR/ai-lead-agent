import { findCity, findIndustry } from "@mela/config";
import Link from "next/link";

import { Fact } from "@/components/fact";
import { LeadFiltersBar } from "@/components/lead-filters-bar";
import { Panel } from "@/components/panel";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { formatLabel } from "@/lib/format-label";
import { buildLeadsQuery, leadListFiltersSchema } from "@/lib/lead-filters";
import type { ListedLead } from "@/lib/leads";
import { type RawSearchParams, parseSearchParams } from "@/lib/search-params";

/**
 * Fetches the filtered lead list and renders it, or the condition that
 * kept it from loading (design D7) — this panel's failure never takes the
 * rest of the page, including the filter controls, down with it.
 */
async function LeadList({ query }: { query: string }) {
  const url = apiUrl(`/leads${query}`);

  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<ListedLead[]>(url);

  if (result.status !== "ok") {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Leads are unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const leads = result.data;

  if (leads.length === 0) {
    return <p className="text-sm text-muted-foreground">No leads match these filters.</p>;
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

interface LeadsPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const rawParams = await searchParams;
  const filters = parseSearchParams(rawParams, leadListFiltersSchema);
  const query = buildLeadsQuery(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <p className="text-muted-foreground">Leads ranked by score, with their full evidence.</p>
      </div>

      <LeadFiltersBar
        priority={filters.priority}
        status={filters.status}
        industryId={filters.industryId}
        cityId={filters.cityId}
        serviceId={filters.serviceId}
        stale={filters.stale}
      />

      <Panel title="Leads">
        <LeadList query={query} />
      </Panel>
    </div>
  );
}
