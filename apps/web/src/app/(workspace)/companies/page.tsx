import Link from "next/link";

import { CompanyFiltersBar } from "@/components/company-filters-bar";
import { CompanyListTable } from "@/components/company-list-table";
import { Unavailable } from "@/components/data-state";
import { Panel } from "@/components/panel";
import { TableSkeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api";
import type { ListedCompany } from "@/lib/companies";
import { buildCompaniesQuery, companyListFiltersSchema } from "@/lib/company-filters";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { type RawSearchParams, parseSearchParams } from "@/lib/search-params";

/**
 * A company's pipeline stage is never one column pretending to be the whole
 * story (design D4): verification, website analysis and opportunity
 * analysis are three independent outcomes, and a company can be sitting in
 * any combination of them — including failed or blocked in one while never
 * having reached another.
 */
async function CompanyList({ query, filtered }: { query: string; filtered: boolean }) {
  const url = apiUrl(`/companies${query}`);

  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<ListedCompany[]>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Companies" status={result.status} error={result.error} />;
  }

  return <CompanyListTable companies={result.data} filtered={filtered} />;
}

interface CompaniesPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const rawParams = await searchParams;
  const filters = parseSearchParams(rawParams, companyListFiltersSchema);
  const query = buildCompaniesQuery(filters);
  const hasFilters = Object.values(filters).some((value) => value !== undefined);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">
            Verification state, analysis outcome and pipeline stage for every discovered company.
          </p>
        </div>
        <Link
          href="/companies/needs-attention"
          className="shrink-0 text-sm text-primary underline-offset-4 hover:underline"
        >
          Needs attention
        </Link>
      </div>

      <CompanyFiltersBar
        verificationState={filters.verificationState}
        industryId={filters.industryId}
        cityId={filters.cityId}
      />

      <Panel
        title="Companies"
        fallback={<TableSkeleton rows={8} columns={7} label="Loading companies" />}
      >
        <CompanyList query={query} filtered={hasFilters} />
      </Panel>
    </div>
  );
}
