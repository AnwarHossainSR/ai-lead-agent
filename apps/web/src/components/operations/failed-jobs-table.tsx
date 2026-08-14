"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "@/app/(workspace)/operations/actions";
import { Button } from "@/components/ui/button";
import type { FailedJob } from "@/lib/operations";

interface FailedJobsTableProps {
  jobs: readonly FailedJob[];
  onRetry: (dlqId: string) => Promise<ActionResult>;
}

/**
 * Every failed job gets its own explicit retry action (task 8.1) — no bulk
 * retry, matching the outreach queue's no-bulk-action convention (design D3).
 * A retry that fails states why instead of silently doing nothing.
 */
export function FailedJobsTable({ jobs, onRetry }: FailedJobsTableProps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [retriedIds, setRetriedIds] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  if (jobs.length === 0) {
    return <p className="text-sm text-muted-foreground">No failed jobs.</p>;
  }

  function handleRetry(dlqId: string) {
    setPendingId(dlqId);
    setErrors((current) => {
      const { [dlqId]: _removed, ...rest } = current;
      return rest;
    });

    startTransition(async () => {
      const result = await onRetry(dlqId);
      setPendingId(null);

      if (result.ok) {
        setRetriedIds((current) => new Set(current).add(dlqId));
      } else {
        setErrors((current) => ({ ...current, [dlqId]: result.error }));
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-2 font-medium">Queue</th>
            <th className="px-4 py-2 font-medium">Failed at</th>
            <th className="px-4 py-2 font-medium">Reason</th>
            <th className="px-4 py-2 font-medium">Retry</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.dlqId} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{job.queueName}</td>
              <td className="px-4 py-2 text-muted-foreground">{job.failedAt}</td>
              <td className="px-4 py-2 text-muted-foreground">
                {job.responseStatus !== null ? `HTTP ${job.responseStatus}: ` : ""}
                {job.reason}
              </td>
              <td className="px-4 py-2">
                {retriedIds.has(job.dlqId) ? (
                  <span className="text-xs text-muted-foreground italic">Retried</span>
                ) : (
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending && pendingId === job.dlqId}
                      onClick={() => handleRetry(job.dlqId)}
                    >
                      {isPending && pendingId === job.dlqId ? "Retrying…" : "Retry"}
                    </Button>
                    {errors[job.dlqId] ? (
                      <span role="alert" className="text-xs text-destructive">
                        {errors[job.dlqId]}
                      </span>
                    ) : null}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
