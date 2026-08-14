import { findCity, findCountry, findIndustry } from "@mela/config";
import { RadarIcon } from "lucide-react";

import { Unavailable } from "@/components/data-state";
import { FailedJobsTable } from "@/components/operations/failed-jobs-table";
import { Panel } from "@/components/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api";
import type { DiscoveryRunRecord } from "@/lib/discovery-runs";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { formatAge } from "@/lib/format-age";
import { formatLabel } from "@/lib/format-label";
import type { FailedJob, QueueSummary } from "@/lib/operations";
import { retryFailedJobAction } from "./actions";

/**
 * Jobs run through Upstash QStash (HTTP push), not a pollable local queue, so
 * there is no live pending count to show — only each queue's configuration
 * and how many of its messages have exhausted their retries and landed in
 * the dead-letter queue. That is stated here rather than implied, so an
 * operator does not read "0 failed" as "nothing in flight."
 */
async function QueuesPanel() {
  const url = apiUrl("/operations/queues");
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<QueueSummary[]>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Queues" status={result.status} error={result.error} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-2 font-medium">Queue</th>
            <th className="px-4 py-2 font-medium">Concurrency</th>
            <th className="px-4 py-2 font-medium">Max attempts</th>
            <th className="px-4 py-2 font-medium">Timeout</th>
            <th className="px-4 py-2 font-medium">Failed (in DLQ)</th>
          </tr>
        </thead>
        <tbody>
          {result.data.map((queue) => (
            <tr key={queue.name} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{queue.name}</td>
              <td className="px-4 py-2">{queue.concurrency}</td>
              <td className="px-4 py-2">{queue.attempts}</td>
              <td className="px-4 py-2">{Math.round(queue.timeoutMs / 1000)}s</td>
              <td className="px-4 py-2">
                {queue.failedCount > 0 ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {queue.failedCount}
                  </span>
                ) : (
                  "0"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function FailedJobsPanel() {
  const url = apiUrl("/operations/failed-jobs");
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<FailedJob[]>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Failed jobs" status={result.status} error={result.error} />;
  }

  return <FailedJobsTable jobs={result.data} onRetry={retryFailedJobAction} />;
}

function DiscoveryRunSourcesTable({ record }: { record: DiscoveryRunRecord }) {
  if (record.sources.length === 0) {
    return <p className="text-sm text-muted-foreground">No sources recorded.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border text-left text-xs text-muted-foreground uppercase">
        <tr>
          <th className="py-1 pr-4 font-medium">Source</th>
          <th className="py-1 pr-4 font-medium">Outcome</th>
          <th className="py-1 pr-4 font-medium">Returned</th>
          <th className="py-1 pr-4 font-medium">Stored</th>
          <th className="py-1 pr-4 font-medium">Duplicate</th>
          <th className="py-1 pr-4 font-medium">Rejected</th>
        </tr>
      </thead>
      <tbody>
        {record.sources.map((source) => (
          <tr key={source.id} className="border-b border-border last:border-0">
            <td className="py-1 pr-4">{source.sourceId}</td>
            <td className="py-1 pr-4">
              {source.outcome === "succeeded" ? (
                formatLabel(source.outcome)
              ) : (
                <span
                  className="text-amber-700 dark:text-amber-400"
                  title={source.note ?? undefined}
                >
                  {formatLabel(source.outcome)}
                </span>
              )}
            </td>
            <td className="py-1 pr-4">{source.returnedCount}</td>
            <td className="py-1 pr-4">{source.storedCount}</td>
            <td className="py-1 pr-4">{source.duplicateCount}</td>
            <td className="py-1 pr-4">{source.rejectedCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function DiscoveryRunsPanel() {
  const url = apiUrl("/discovery/runs");
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<DiscoveryRunRecord[]>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Discovery runs" status={result.status} error={result.error} />;
  }

  if (result.data.length === 0) {
    return (
      <EmptyState
        icon={<RadarIcon />}
        title="No discovery runs yet"
        description="A run appears here once one has been started. None have been."
      />
    );
  }

  return (
    <div className="space-y-4">
      {result.data.map((record) => {
        const { run } = record;
        const country = findCountry(run.countryId)?.name ?? run.countryId;
        const city = run.cityId ? (findCity(run.cityId)?.name ?? run.cityId) : null;
        const industry = findIndustry(run.industryId)?.name ?? run.industryId;

        return (
          <div key={run.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {industry} — {city ? `${city}, ` : ""}
                {country}
              </p>
              <p className="text-sm">
                {run.outcome === "succeeded" ? (
                  formatLabel(run.outcome)
                ) : (
                  <span
                    className="font-medium text-amber-700 dark:text-amber-400"
                    title={run.failureReason ?? undefined}
                  >
                    {formatLabel(run.outcome)}
                  </span>
                )}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Started {formatAge(run.startedAt)}
              {run.finishedAt ? ` — finished ${formatAge(run.finishedAt)}` : " — still running"}
            </p>
            <div className="mt-3 overflow-x-auto">
              <DiscoveryRunSourcesTable record={record} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
        <p className="text-muted-foreground">
          Queue configuration and dead-letter counts, failed jobs with an explicit retry, and
          discovery runs with their per-source counts and outcomes.
        </p>
      </div>

      <Panel
        title="Queues"
        fallback={<TableSkeleton rows={4} columns={5} label="Loading queues" />}
      >
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-4 font-medium">Queues</h2>
          <QueuesPanel />
        </div>
      </Panel>

      <Panel
        title="Failed jobs"
        fallback={<TableSkeleton rows={4} columns={5} label="Loading failed jobs" />}
      >
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-4 font-medium">Failed jobs</h2>
          <FailedJobsPanel />
        </div>
      </Panel>

      <Panel
        title="Discovery runs"
        fallback={<TableSkeleton rows={5} columns={8} label="Loading discovery runs" />}
      >
        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-4 font-medium">Discovery runs</h2>
          <DiscoveryRunsPanel />
        </div>
      </Panel>
    </div>
  );
}
