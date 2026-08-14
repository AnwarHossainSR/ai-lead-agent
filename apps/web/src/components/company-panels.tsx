import { ContactList } from "@/components/lead-detail/contact-list";
import { OpportunityList } from "@/components/lead-detail/opportunity-list";
import { TechnologyList } from "@/components/lead-detail/technology-list";
import { fetchAccounts } from "@/lib/accounts";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type {
  Contact,
  LatestAnalysis,
  OpportunityWithEvidence,
  TechnologyDetection,
} from "@/lib/lead-detail";

/**
 * Panels keyed only by companyId — shared between the lead detail view
 * (task 4.2) and the company detail view (task 6.2), since both show the
 * same company-scoped opportunities, detections and contacts.
 */

export function Unavailable({ title, error }: { title: string; error: string }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">{title} is unavailable</p>
      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
    </div>
  );
}

export async function OpportunitiesPanel({ companyId }: { companyId: string }) {
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

export async function TechnologiesPanel({ companyId }: { companyId: string }) {
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

export async function ContactsPanel({ companyId }: { companyId: string }) {
  const url = apiUrl(`/companies/${companyId}/contacts`);
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<{ contacts: Contact[] }>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Contacts" error={result.error} />;
  }

  const accounts = await fetchAccounts();

  return <ContactList contacts={result.data.contacts} accounts={accounts} />;
}
