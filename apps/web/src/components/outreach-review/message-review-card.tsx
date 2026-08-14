"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { ActionResult } from "@/app/(workspace)/outreach/review/actions";
import { Button } from "@/components/ui/button";
import { formatLabel } from "@/lib/format-label";

const ACTIONABLE_STATUSES = new Set(["draft", "pending_approval", "approved"]);

/** `<input type="datetime-local">` wants "YYYY-MM-DDTHH:mm", not an ISO string. */
function nowForDateTimeLocalInput(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString().slice(0, 16);
}

interface MessageReviewCardProps {
  outreachId: string;
  status: string;
  channel: string;
  subject: string | null;
  messageBody: string;
  isHumanEdited: boolean;
  rejectionReason: string | null;
  onApprove: (outreachId: string) => Promise<ActionResult>;
  onReject: (outreachId: string, reason: string) => Promise<ActionResult>;
  onCancel: (outreachId: string) => Promise<ActionResult>;
  onSave: (
    outreachId: string,
    changes: { subject?: string; messageBody?: string },
  ) => Promise<ActionResult>;
  onRecordSent: (
    outreachId: string,
    input: { means: string; sentAt: string },
  ) => Promise<ActionResult>;
}

/**
 * The message half of the review layout (design D3): editable text, and
 * approve/reject/cancel — no send control and no way to act on more than
 * this one message.
 *
 * Approve stays disabled until the message body has actually been rendered
 * in the viewport (design D3) — that is the mechanism, not a hope, so it is
 * driven by an IntersectionObserver on the body itself rather than a timer
 * or a "scroll to the bottom" assumption.
 *
 * An approved message can no longer be approved or rejected — the API
 * refuses both from `approved` — so it gets a different action set: edit,
 * cancel, and recording that it was sent through some other tool. That last
 * action is described as recording, never as sending, because nothing in
 * this application transmits anything (dashboard spec: "Recording a send is
 * described as recording").
 */
export function MessageReviewCard({
  outreachId,
  status,
  channel,
  subject,
  messageBody,
  isHumanEdited,
  rejectionReason,
  onApprove,
  onReject,
  onCancel,
  onSave,
  onRecordSent,
}: MessageReviewCardProps) {
  const [hasBeenViewed, setHasBeenViewed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRecordingSent, setIsRecordingSent] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState(subject ?? "");
  const [bodyDraft, setBodyDraft] = useState(messageBody);
  const [rejectionDraft, setRejectionDraft] = useState("");
  const [meansDraft, setMeansDraft] = useState("");
  const [sentAtDraft, setSentAtDraft] = useState(nowForDateTimeLocalInput);
  const [error, setError] = useState<string | null>(null);
  const [revokedApproval, setRevokedApproval] = useState(false);
  const [recordedSent, setRecordedSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLDivElement>(null);
  const wasApprovedWhenEditStarted = useRef(false);

  useEffect(() => {
    const node = bodyRef.current;
    if (node === null || hasBeenViewed) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasBeenViewed(true);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasBeenViewed]);

  const isActionable = ACTIONABLE_STATUSES.has(status);
  const isApproved = status === "approved";

  function runAction(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  if (!isActionable) {
    return (
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm font-medium">
          This message is {formatLabel(status)}
          {rejectionReason ? `: ${rejectionReason}` : "."}
        </p>
        <MessageBody subject={subject} messageBody={messageBody} channel={channel} />
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      {isHumanEdited && (
        <p className="text-xs text-muted-foreground uppercase">Edited since it was drafted</p>
      )}

      {isEditing ? (
        <div className="space-y-2">
          {subject !== null && (
            <input
              value={subjectDraft}
              onChange={(event) => setSubjectDraft(event.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-medium"
              aria-label="Subject"
            />
          )}
          <textarea
            value={bodyDraft}
            onChange={(event) => setBodyDraft(event.target.value)}
            rows={8}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            aria-label="Message body"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(async () => {
                  const result = await onSave(outreachId, {
                    subject: subject !== null ? subjectDraft : undefined,
                    messageBody: bodyDraft,
                  });
                  if (result.ok) {
                    setIsEditing(false);
                    // Editing an approved message revokes its approval and
                    // returns it to the queue as a draft (design D1's
                    // approve-after-render rule loses meaning otherwise) —
                    // said explicitly here since the status change alone,
                    // after a revalidation, wouldn't otherwise be noticed.
                    if (wasApprovedWhenEditStarted.current) {
                      setRevokedApproval(true);
                    }
                  }
                  return result;
                })
              }
            >
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setSubjectDraft(subject ?? "");
                setBodyDraft(messageBody);
                setIsEditing(false);
              }}
            >
              Cancel edit
            </Button>
          </div>
        </div>
      ) : (
        <div ref={bodyRef}>
          <MessageBody subject={subject} messageBody={messageBody} channel={channel} />
        </div>
      )}

      {revokedApproval && (
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Editing this message revoked its approval — it returned to the queue as a draft and needs
          to be approved again.
        </p>
      )}

      {recordedSent && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Recorded as sent.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!isEditing && !isRejecting && !isRecordingSent && !recordedSent && (
        <div className="flex flex-wrap gap-2">
          {isApproved ? (
            <Button type="button" disabled={isPending} onClick={() => setIsRecordingSent(true)}>
              Record as sent…
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!hasBeenViewed || isPending}
              title={hasBeenViewed ? undefined : "Read the message before approving"}
              onClick={() => runAction(() => onApprove(outreachId))}
            >
              Approve
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              wasApprovedWhenEditStarted.current = isApproved;
              setIsEditing(true);
            }}
          >
            Edit
          </Button>
          {!isApproved && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsRejecting(true)}
            >
              Reject…
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => runAction(() => onCancel(outreachId))}
          >
            Cancel
          </Button>
        </div>
      )}

      {isRejecting && (
        <div className="space-y-2">
          <label htmlFor="rejection-reason" className="text-sm font-medium">
            Reason for rejecting
          </label>
          <textarea
            id="rejection-reason"
            value={rejectionDraft}
            onChange={(event) => setRejectionDraft(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={rejectionDraft.trim().length === 0 || isPending}
              onClick={() => runAction(() => onReject(outreachId, rejectionDraft))}
            >
              Confirm reject
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setRejectionDraft("");
                setIsRejecting(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isRecordingSent && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-sm text-muted-foreground">
            This records that the message was already sent through another tool. It does not send
            anything.
          </p>
          <label htmlFor="sent-means" className="text-sm font-medium">
            How was it sent?
          </label>
          <input
            id="sent-means"
            value={meansDraft}
            onChange={(event) => setMeansDraft(event.target.value)}
            placeholder="e.g. Gmail, Outlook"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          <label htmlFor="sent-at" className="text-sm font-medium">
            When was it sent?
          </label>
          <input
            id="sent-at"
            type="datetime-local"
            value={sentAtDraft}
            onChange={(event) => setSentAtDraft(event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={meansDraft.trim().length === 0 || isPending}
              onClick={() =>
                runAction(async () => {
                  const result = await onRecordSent(outreachId, {
                    means: meansDraft,
                    sentAt: new Date(sentAtDraft).toISOString(),
                  });
                  if (result.ok) {
                    setIsRecordingSent(false);
                    setRecordedSent(true);
                  }
                  return result;
                })
              }
            >
              Record as sent
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setMeansDraft("");
                setIsRecordingSent(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBody({
  subject,
  messageBody,
  channel,
}: {
  subject: string | null;
  messageBody: string;
  channel: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground uppercase">{formatLabel(channel)}</p>
      {subject !== null && <p className="font-medium">{subject}</p>}
      <p className="whitespace-pre-wrap text-sm">{messageBody}</p>
    </div>
  );
}
