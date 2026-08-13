import Link from "next/link";

import { CompanyFiltersBar } from "@/components/company-filters-bar";
import { CompanyListTable } from "@/components/company-list-table";
import { Panel } from "@/components/panel";
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
async function CompanyList({ query }: { query: string }) {
  const url = apiUrl(`/companies${query}`);

  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<ListedCompany[]>(url);

  if (result.status !== "ok") {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm font-medium text-destructive">Companies are unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  return <CompanyListTable companies={result.data} />;
}

interface CompaniesPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const rawParams = await searchParams;
  const filters = parseSearchParams(rawParams, companyListFiltersSchema);
  const query = buildCompaniesQuery(filters);

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

      <Panel title="Companies">
        <CompanyList query={query} />
      </Panel>
    </div>
  );
}
