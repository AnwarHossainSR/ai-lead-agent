import { findCity, findIndustry } from "@mela/config";

import { ContactList } from "@/components/lead-detail/contact-list";
import { OpportunityList } from "@/components/lead-detail/opportunity-list";
import { ResearchSummaryView } from "@/components/lead-detail/research-summary-view";
import { TechnologyList } from "@/components/lead-detail/technology-list";
import { Panel } from "@/components/panel";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { formatLabel } from "@/lib/format-label";
import type {
  Contact,
  LatestAnalysis,
  LeadDetail,
  OpportunityWithEvidence,
  ResearchSummary,
  TechnologyDetection,
} from "@/lib/lead-detail";

const SCORE_COMPONENTS: readonly { key: keyof LeadDetail; label: string }[] = [
  { key: "businessFitScore", label: "Business Fit" },
  { key: "technicalOpportunityScore", label: "Technical Opportunity" },
  { key: "businessOpportunityScore", label: "Business Opportunity" },
  { key: "decisionMakerFoundScore", label: "Decision Maker Found" },
  { key: "companyQualityScore", label: "Company Quality" },
];

function Unavailable({ title, error }: { title: string; error: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">{title} is unavailable</p>
      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
    </div>
  );
}

async function OpportunitiesPanel({ companyId }: { companyId: string }) {
  const url = apiUrl(`/companies/${companyId}/opportunities`);
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<OpportunityWithEvidence[]>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Opportunities" error={result.error} />;
  }

  return <OpportunityList opportunities={result.data} />;
}

async function TechnologiesPanel({ companyId }: { companyId: string }) {
  const technologiesUrl = apiUrl(`/companies/${companyId}/technologies`);
  const analysisUrl = apiUrl(`/companies/${companyId}/analysis/latest`);

  if (technologiesUrl === null || analysisUrl === null) {
    return <Unavailable title="Detected technologies" error="API_URL is not configured." />;
  }

  const [technologiesResult, analysisResult] = await Promise.all([
    fetchWithTimeout<{ technologies: TechnologyDetection[] }>(technologiesUrl),
    fetchWithTimeout<LatestAnalysis>(analysisUrl),
  ]);

  if (technologiesResult.status !== "ok") {
    return <Unavailable title="Detected technologies" error={technologiesResult.error} />;
  }

  // A missing or failed analysis just means citations can't link to a source
  // page — the detections themselves still came back and are worth showing.
  const analysis = analysisResult.status === "ok" ? analysisResult.data : null;

  return <TechnologyList detections={technologiesResult.data.technologies} analysis={analysis} />;
}

async function ResearchSummaryPanel({ leadId }: { leadId: string }) {
  const url = apiUrl(`/leads/${leadId}/research-summary`);
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<{ summary: ResearchSummary | null }>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Research summary" error={result.error} />;
  }

  return <ResearchSummaryView summary={result.data.summary} />;
}

async function ContactsPanel({ companyId }: { companyId: string }) {
  const url = apiUrl(`/companies/${companyId}/contacts`);
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<{ contacts: Contact[] }>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Contacts" error={result.error} />;
  }

  return <ContactList contacts={result.data.contacts} />;
}

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const url = apiUrl(`/leads/${id}`);

  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<LeadDetail>(url);

  if (result.status !== "ok") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Lead</h1>
        <Unavailable title="This lead" error={result.error} />
      </div>
    );
  }

  const lead = result.data;
  const industryName = findIndustry(lead.company.industryId)?.name ?? lead.company.industryId;
  const cityName = lead.company.cityId
    ? (findCity(lead.company.cityId)?.name ?? lead.company.cityId)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{lead.company.name}</h1>
        <p className="text-muted-foreground">
          {industryName}
          {cityName ? ` · ${cityName}` : ""} · {formatLabel(lead.company.verificationState)}
          {lead.company.website ? (
            <>
              {" · "}
              <a
                href={lead.company.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {lead.company.website}
              </a>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
        <div>
          <p className="text-sm text-muted-foreground">Score</p>
          <p className="text-2xl font-bold">{lead.leadScore}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Priority</p>
          <p className="font-medium">{formatLabel(lead.priority)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="font-medium">{formatLabel(lead.status)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Staleness</p>
          <p className="font-medium">{lead.isStale ? "Stale" : "Fresh"}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4">
        <h2 className="font-medium">Score breakdown</h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SCORE_COMPONENTS.map(({ key, label }) => (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium">{lead[key] as number}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-4 text-sm font-medium">Explanation</h3>
        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-sm text-muted-foreground">
          {lead.scoreExplanation}
        </pre>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Research summary</h2>
        <Panel title="Research summary">
          <ResearchSummaryPanel leadId={lead.id} />
        </Panel>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Opportunities</h2>
        <Panel title="Opportunities">
          <OpportunitiesPanel companyId={lead.companyId} />
        </Panel>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Detected technologies</h2>
        <Panel title="Detected technologies">
          <TechnologiesPanel companyId={lead.companyId} />
        </Panel>
      </div>

      <div>
        <h2 className="mb-2 font-medium">Contacts</h2>
        <Panel title="Contacts">
          <ContactsPanel companyId={lead.companyId} />
        </Panel>
      </div>
    </div>
  );
}
