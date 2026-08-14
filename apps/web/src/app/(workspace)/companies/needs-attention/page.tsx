import { findCity, findIndustry } from "@mela/config";
import Link from "next/link";

import { Unavailable } from "@/components/data-state";
import { Panel } from "@/components/panel";
import { TableSkeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { formatAge } from "@/lib/format-age";
import type { NeedsAttentionRecord, NeedsAttentionResult } from "@/lib/needs-attention";

/**
 * Collects everything blocked, failed or unreachable (design D4) so a
 * failure state is a place to look, not something silently dropped from
 * every other list. Carries counts and ages per design D4's risk note —
 * the point is to show what has been neglected longest, not to accumulate
 * a graveyard nobody looks at.
 */

function RecordTable({ records }: { records: readonly NeedsAttentionRecord[] }) {
  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">None.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-2 font-medium">Company</th>
            <th className="px-4 py-2 font-medium">Industry</th>
            <th className="px-4 py-2 font-medium">City</th>
            <th className="px-4 py-2 font-medium">Reason</th>
            <th className="px-4 py-2 font-medium">Age</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={`${record.companyId}-${record.since}`}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-2">
                <Link
                  href={`/companies/${record.companyId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {record.companyName}
                </Link>
              </td>
              <td className="px-4 py-2">
                {findIndustry(record.industryId)?.name ?? record.industryId}
              </td>
              <td className="px-4 py-2">
                {record.cityId ? (findCity(record.cityId)?.name ?? record.cityId) : "—"}
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {record.reason ?? <span className="italic">No reason recorded</span>}
              </td>
              <td className="px-4 py-2 text-muted-foreground">{formatAge(record.since)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function NeedsAttentionSections() {
  const url = apiUrl("/companies/needs-attention");
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<NeedsAttentionResult>(url);

  if (result.status !== "ok") {
    return <Unavailable title="Needs attention" status={result.status} error={result.error} />;
  }

  const { blocked, failed, unreachable } = result.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 font-medium">Blocked ({blocked.length})</h2>
        <RecordTable records={blocked} />
      </div>
      <div>
        <h2 className="mb-2 font-medium">Failed ({failed.length})</h2>
        <RecordTable records={failed} />
      </div>
      <div>
        <h2 className="mb-2 font-medium">Unreachable ({unreachable.length})</h2>
        <RecordTable records={unreachable} />
      </div>
    </div>
  );
}

export default function NeedsAttentionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Needs Attention</h1>
        <p className="text-muted-foreground">
          Companies blocked or failed at analysis, and companies unreachable at verification.
        </p>
      </div>

      <Panel
        title="Needs attention"
        fallback={
          <TableSkeleton rows={6} columns={6} label="Loading companies needing attention" />
        }
      >
        <NeedsAttentionSections />
      </Panel>
    </div>
  );
}
