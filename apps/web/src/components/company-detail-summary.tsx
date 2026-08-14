import { findCity, findIndustry } from "@mela/config";
import Link from "next/link";

import type { CompanyDetail } from "@/lib/company-detail";
import { formatLabel } from "@/lib/format-label";

/**
 * The static half of the company detail view: identity, do-not-contact
 * status, lead link and discovery provenance. Pure — takes the already
 * fetched `CompanyDetail` — so it renders in jsdom, unlike the async panels
 * beside it on the page.
 */
export function CompanyDetailSummary({ company }: { company: CompanyDetail }) {
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
        Discovered via{" "}
        <a
          href={company.discoverySourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-4 hover:underline"
        >
          {formatLabel(company.discoverySource)}
        </a>
        {company.verifiedAt ? ` · Verified ${new Date(company.verifiedAt).toLocaleString()}` : ""}
      </div>
    </div>
  );
}
