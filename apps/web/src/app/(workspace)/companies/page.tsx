import { findCity, findIndustry } from "@mela/config";
import Link from "next/link";

import { CompanyFiltersBar } from "@/components/company-filters-bar";
import { Fact } from "@/components/fact";
import { Panel } from "@/components/panel";
import { apiUrl } from "@/lib/api";
import type { ListedCompany } from "@/lib/companies";
import { buildCompaniesQuery, companyListFiltersSchema } from "@/lib/company-filters";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { formatLabel } from "@/lib/format-label";
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

  const companies = result.data;

  if (companies.length === 0) {
    return <p className="text-sm text-muted-foreground">No companies match these filters.</p>;
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

interface CompaniesPageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const rawParams = await searchParams;
  const filters = parseSearchParams(rawParams, companyListFiltersSchema);
  const query = buildCompaniesQuery(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        <p className="text-muted-foreground">
          Verification state, analysis outcome and pipeline stage for every discovered company.
        </p>
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
