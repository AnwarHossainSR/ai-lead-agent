import { Fact } from "@/components/fact";
import { Panel } from "@/components/panel";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

interface CountResponse {
  readonly count: number;
}

/**
 * Fetches one stat's count and renders it through `<Fact>`. A Server
 * Component passed as a Client Component's children (design D1) — the
 * fetch, and its degraded/unreachable conditions, run on the server.
 */
async function StatCount({ path }: { path: string }) {
  const url = apiUrl(path);

  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<CountResponse>(url);

  if (result.status !== "ok") {
    return (
      <span title={result.error}>
        <Fact fact={{ certainty: "unknown" }} />
      </span>
    );
  }

  return (
    <Fact fact={{ certainty: "observed", value: result.data.count }} format={(value) => value} />
  );
}

function StatCard({ title, path }: { title: string; path: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-bold">
        <Panel
          title={title}
          fallback={<span className="inline-block h-7 w-10 animate-pulse rounded bg-muted" />}
        >
          <StatCount path={path} />
        </Panel>
      </p>
    </div>
  );
}

export default function Home() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to MELA — AI-assisted B2B lead generation</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Companies" path="/companies/count" />
        <StatCard title="Active Leads" path="/leads/count?active=true" />
        <StatCard title="Awaiting Review" path="/outreach/count?status=pending_approval" />
        <StatCard
          title="Sent This Week"
          path={`/outreach/count?status=sent&sentAfter=${encodeURIComponent(sevenDaysAgo)}`}
        />
      </div>
    </div>
  );
}
