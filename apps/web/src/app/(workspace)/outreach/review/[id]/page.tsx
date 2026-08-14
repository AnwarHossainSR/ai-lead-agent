import Link from "next/link";

import { CitedFactsPanel } from "@/components/outreach-review/cited-facts-panel";
import { MessageReviewCard } from "@/components/outreach-review/message-review-card";
import { fetchAccounts, resolveAccountEmail } from "@/lib/accounts";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { LeadDetail } from "@/lib/lead-detail";
import type { OutreachRecord } from "@/lib/outreach";
import { getCurrentAccount } from "@/lib/session";
import {
  approveOutreachAction,
  cancelOutreachAction,
  recordOutreachSentAction,
  rejectOutreachAction,
  updateOutreachAction,
} from "../actions";
import { fetchAwaitingReview } from "../awaiting-review";

interface ReviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function OutreachReviewMessagePage({ params }: ReviewPageProps) {
  const { id } = await params;

  const outreachUrl = apiUrl(`/outreach/${id}`);
  const outreachResult =
    outreachUrl === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<OutreachRecord>(outreachUrl);

  if (outreachResult.status !== "ok") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Outreach Review</h1>
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-destructive">This message is unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{outreachResult.error}</p>
        </div>
      </div>
    );
  }

  const outreachMessage = outreachResult.data;

  const [leadResult, queueResult, accounts, account] = await Promise.all([
    (async () => {
      const url = apiUrl(`/leads/${outreachMessage.leadId}`);
      return url === null
        ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
        : fetchWithTimeout<LeadDetail>(url);
    })(),
    fetchAwaitingReview(200),
    fetchAccounts(),
    getCurrentAccount(),
  ]);

  const companyName = leadResult.status === "ok" ? leadResult.data.company.name : null;
  const canApprove = account?.role === "operator";

  const approval = outreachMessage.approvedAt
    ? {
        email: resolveAccountEmail(accounts, outreachMessage.approvedByAccountId),
        at: outreachMessage.approvedAt,
      }
    : null;
  const rejection = outreachMessage.rejectedAt
    ? {
        email: resolveAccountEmail(accounts, outreachMessage.rejectedByAccountId),
        at: outreachMessage.rejectedAt,
      }
    : null;
  const send =
    outreachMessage.sentAt && outreachMessage.sentMeans
      ? {
          email: resolveAccountEmail(accounts, outreachMessage.sentByAccountId),
          at: outreachMessage.sentAt,
          means: outreachMessage.sentMeans,
        }
      : null;

  const queue = queueResult.status === "ok" ? queueResult.data : [];
  const position = queue.findIndex((item) => item.id === outreachMessage.id);
  const nextInQueue = position >= 0 ? queue[(position + 1) % queue.length] : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Outreach Review</h1>
        <p className="text-muted-foreground">
          {companyName ? `To ${companyName}` : "Drafts awaiting approval, one at a time."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MessageReviewCard
          outreachId={outreachMessage.id}
          status={outreachMessage.status}
          channel={outreachMessage.channel}
          subject={outreachMessage.subject}
          messageBody={outreachMessage.messageBody}
          isHumanEdited={outreachMessage.isHumanEdited}
          rejectionReason={outreachMessage.rejectionReason}
          canApprove={canApprove}
          approval={approval}
          rejection={rejection}
          send={send}
          onApprove={approveOutreachAction}
          onReject={rejectOutreachAction}
          onCancel={cancelOutreachAction}
          onSave={updateOutreachAction}
          onRecordSent={recordOutreachSentAction}
        />

        <div>
          <h2 className="mb-2 font-medium">Facts it cites</h2>
          <CitedFactsPanel
            claims={outreachMessage.citedFacts}
            recordedAt={outreachMessage.createdAt}
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4 text-sm text-muted-foreground">
        <span>
          {queue.length > 0
            ? `${position >= 0 ? position + 1 : "?"} of ${queue.length} awaiting review`
            : "No messages awaiting review"}
        </span>
        {nextInQueue && nextInQueue.id !== outreachMessage.id && (
          <Link
            href={`/outreach/review/${nextInQueue.id}`}
            className="font-medium text-primary hover:underline"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
