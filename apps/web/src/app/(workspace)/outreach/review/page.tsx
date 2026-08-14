import { redirect } from "next/navigation";

import { fetchAwaitingReview } from "./awaiting-review";

/**
 * The queue's entry point: no list, no multi-select — it hands the operator
 * straight into a message awaiting review (design D3). "One message at a
 * time" starts here, not just inside the reviewer itself. Covers both
 * `pending_approval` and never-submitted `draft` messages, newest first.
 */
export default async function OutreachReviewPage() {
  const result = await fetchAwaitingReview(1);

  if (result.status === "ok" && result.data.length > 0) {
    redirect(`/outreach/review/${result.data[0]!.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Outreach Review</h1>
        <p className="text-muted-foreground">
          Drafts awaiting approval, one at a time, beside the facts they cite.
        </p>
      </div>
      {result.status === "ok" ? (
        <p className="text-sm text-muted-foreground">No messages are awaiting review.</p>
      ) : (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">The review queue is unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
        </div>
      )}
    </div>
  );
}
