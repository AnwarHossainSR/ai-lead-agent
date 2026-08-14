import { Unavailable } from "@/components/data-state";
import { LeadFiltersBar } from "@/components/lead-filters-bar";
import { LeadListTable } from "@/components/lead-list-table";
import { Panel } from "@/components/panel";
import { TableSkeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { buildLeadsQuery, leadListFiltersSchema } from "@/lib/lead-filters";
import type { ListedLead } from "@/lib/leads";
import { type RawSearchParams, parseSearchParams } from "@/lib/search-params";

/**
 * Fetches the filtered lead list and renders it, or the condition that
 * kept it from loading (design D7) — this panel's failure never takes the
 * rest of the page, including the filter controls, down with it.
 */
async function LeadList({ query, filtered }: { query: string; filtered: boolean }) {
  const url = apiUrl(`/leads${query}`);

  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<ListedLead[]>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Leads" status={result.status} error={result.error} />;
  }

  return <LeadListTable leads={result.data} filtered={filtered} />;
}

interface LeadsPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const rawParams = await searchParams;
  const filters = parseSearchParams(rawParams, leadListFiltersSchema);
  const query = buildLeadsQuery(filters);
  const hasFilters = Object.values(filters).some((value) => value !== undefined);

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

      <Panel title="Leads" fallback={<TableSkeleton rows={8} columns={7} label="Loading leads" />}>
        <LeadList query={query} filtered={hasFilters} />
      </Panel>
    </div>
  );
}
