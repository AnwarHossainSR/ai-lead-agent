import { CompanyDetailSummary } from "@/components/company-detail-summary";
import { ContactsPanel, OpportunitiesPanel, TechnologiesPanel } from "@/components/company-panels";
import { Panel } from "@/components/panel";
import { apiUrl } from "@/lib/api";
import type { CompanyDetail } from "@/lib/company-detail";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

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

  return (
    <div className="space-y-6">
      <CompanyDetailSummary company={company} />

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
