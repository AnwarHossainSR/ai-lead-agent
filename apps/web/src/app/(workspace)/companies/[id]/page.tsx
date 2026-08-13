import { findCity, findIndustry } from "@mela/config";
import Link from "next/link";

import { ContactsPanel, OpportunitiesPanel, TechnologiesPanel } from "@/components/company-panels";
import { Panel } from "@/components/panel";
import { apiUrl } from "@/lib/api";
import type { CompanyDetail } from "@/lib/company-detail";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { formatLabel } from "@/lib/format-label";

interface CompanyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { id } = await params;
  const url = apiUrl(`/companies/${id}`);

  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<CompanyDetail>(url);

  if (result.status !== "ok") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Company</h1>
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">This company is unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
        </div>
      </div>
    );
  }

  const company = result.data;
  const industryName = findIndustry(company.industryId)?.name ?? company.industryId;
  const cityName = company.cityId ? (findCity(company.cityId)?.name ?? company.cityId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
        <p className="text-muted-foreground">
          {industryName}
          {cityName ? ` · ${cityName}` : ""} · {formatLabel(company.verificationState)}
          {company.website ? (
            <>
              {" · "}
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {company.website}
              </a>
            </>
          ) : null}
        </p>
      </div>

      {company.doNotContactAt ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">Do not contact</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.doNotContactReason ?? "No reason recorded."}
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-border p-4">
        <h2 className="font-medium">Lead</h2>
        {company.lead === null ? (
          <p className="mt-2 text-sm text-muted-foreground italic">Not scored</p>
        ) : (
          <Link
            href={`/leads/${company.lead.id}`}
            className="mt-2 flex flex-wrap items-center gap-4 text-sm"
          >
            <span className="text-2xl font-bold text-primary underline-offset-4 hover:underline">
              {company.lead.leadScore}
            </span>
            <span className="text-primary underline-offset-4 hover:underline">
              {formatLabel(company.lead.priority)} · {formatLabel(company.lead.status)}
            </span>
          </Link>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Discovered via {formatLabel(company.discoverySource)}
        {company.verifiedAt ? ` · Verified ${new Date(company.verifiedAt).toLocaleString()}` : ""}
      </div>

      <div>
        <h2 className="mb-2 font-medium">Opportunities</h2>
        <Panel title="Opportunities">
          <OpportunitiesPanel companyId={company.id} />
        </Panel>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Detected technologies</h2>
        <Panel title="Detected technologies">
          <TechnologiesPanel companyId={company.id} />
        </Panel>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Contacts</h2>
        <Panel title="Contacts">
          <ContactsPanel companyId={company.id} />
        </Panel>
      </div>
    </div>
  );
}
