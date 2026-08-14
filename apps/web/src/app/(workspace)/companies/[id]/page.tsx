import { CompanyDetailSummary } from "@/components/company-detail-summary";
import { ContactsPanel, OpportunitiesPanel, TechnologiesPanel } from "@/components/company-panels";
import { Unavailable } from "@/components/data-state";
import { Panel } from "@/components/panel";
import { fetchAccounts, resolveAccountEmail } from "@/lib/accounts";
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
        <Unavailable title="This company" status={result.status} error={result.error} />
      </div>
    );
  }

  const company = result.data;
  const accounts = await fetchAccounts();
  const doNotContactByEmail = resolveAccountEmail(accounts, company.doNotContactByAccountId);

  return (
    <div className="space-y-6">
      <CompanyDetailSummary company={company} doNotContactByEmail={doNotContactByEmail} />

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
