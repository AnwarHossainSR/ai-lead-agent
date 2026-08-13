import { createHash } from "node:crypto";
import { OUTREACH_CHANNELS, type OutreachChannelId } from "@mela/config";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type OutreachRow, outreach } from "../schema/outreach";
import { type Assignments, databaseNow } from "./clock";
import { RecordNotFoundError, WriteValidationError, parseInput } from "./errors";

/**
 * The write API for outreach records.
 *
 * This module stores drafts and records approvals. It sends nothing: there is
 * no transport here, no client, no scheduler, and no function that could be
 * pointed at one. Marking a record sent is something a caller does *after* a
 * human has approved it and something outside this package has transmitted it.
 *
 * `approveOutreach` exists as a separate call for the same reason: approval is
 * a deliberate act with a timestamp, not a field somebody can set while
 * creating a draft.
 */

const channelSchema = z.enum(
  OUTREACH_CHANNELS.map((channel) => channel.id) as [OutreachChannelId, ...OutreachChannelId[]],
);

export const insertOutreachInputSchema = z.object({
  leadId: z.uuid("Expected the identifier of the lead this message is for."),
  channel: channelSchema,
  messageBody: z.string().trim().min(1, "Expected the message body."),
  notes: z
    .string()
    .trim()
    .min(1, "Expected a note or nothing at all; a blank string is not a note.")
    .nullish(),
  isExample: z.boolean().default(false),
});

export type InsertOutreachInput = z.input<typeof insertOutreachInputSchema>;

/**
 * Stores a draft. Always as a draft: there is no parameter for a status, an
 * approval timestamp or a sent timestamp, so a record cannot be created
 * already claiming to have been approved.
 */
export async function insertOutreachDraft(
  executor: Executor,
  input: InsertOutreachInput,
): Promise<OutreachRow> {
  const value = parseInput("The outreach draft", insertOutreachInputSchema, input);

  const [row] = await executor
    .insert(outreach)
    .values({
      id: uuidv7(),
      leadId: value.leadId,
      channel: value.channel,
      subject: null,
      messageBody: value.messageBody,
      status: "draft",
      generatedSubject: null,
      generatedBody: null,
      isHumanEdited: false,
      promptVersion: null,
      aiInvocationId: null,
      citedFacts: [],
      rejectionReason: null,
      rejectedAt: null,
      approvalRevokedAt: null,
      approvedTextHash: null,
      notes: value.notes ?? null,
      isExample: value.isExample,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The outreach insert returned no row.");
  }

  return row;
}

/** Moves a draft to `pending_approval`, where a person looks at it. */
export async function submitOutreachForApproval(
  executor: Executor,
  outreachId: string,
): Promise<OutreachRow> {
  return transition(executor, outreachId, ["draft"], {
    status: "pending_approval",
  });
}

/**
 * Records that a human approved this message, and when.
 *
 * The timestamp is taken here rather than supplied by the caller: an approval
 * time that can be passed in is an approval time that can be backdated.
 */
export async function approveOutreach(
  executor: Executor,
  outreachId: string,
): Promise<OutreachRow> {
  const [current] = await executor
    .select()
    .from(outreach)
    .where(eq(outreach.id, outreachId))
    .limit(1);

  if (current === undefined) {
    throw new RecordNotFoundError("outreach", outreachId);
  }

  if (!["draft", "pending_approval"].includes(current.status)) {
    throw new WriteValidationError("Approving outreach", [
      `Outreach ${outreachId} is "${current.status}"; approval is reachable only from draft, pending_approval.`,
    ]);
  }

  const approvedAt = databaseNow();
  const textHash = createHash("md5")
    .update(`${current.subject ?? ""}\n${current.messageBody}`)
    .digest("hex");

  const [row] = await executor
    .update(outreach)
    .set({
      status: "approved",
      approvedAt,
      approvedTextHash: textHash,
      updatedAt: approvedAt,
    })
    .where(eq(outreach.id, outreachId))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("outreach", outreachId);
  }

  return row;
}

/**
 * Edits the subject and/or body of an outreach record.
 *
 * When the record was approved, editing its text revokes the approval and
 * returns it to `draft`, recording the revocation time. This ensures the text
 * a person read is the text that goes out.
 */
export async function updateOutreachText(
  executor: Executor,
  outreachId: string,
  changes: { subject?: string | null; messageBody?: string },
): Promise<OutreachRow> {
  const [current] = await executor
    .select()
    .from(outreach)
    .where(eq(outreach.id, outreachId))
    .limit(1);

  if (current === undefined) {
    throw new RecordNotFoundError("outreach", outreachId);
  }

  const hasSubjectChange = changes.subject !== undefined && changes.subject !== current.subject;
  const hasBodyChange =
    changes.messageBody !== undefined && changes.messageBody !== current.messageBody;
  const textIsChanging = hasSubjectChange || hasBodyChange;

  if (textIsChanging && current.status === "approved") {
    const [row] = await executor
      .update(outreach)
      .set({
        subject: changes.subject ?? current.subject,
        messageBody: changes.messageBody ?? current.messageBody,
        isHumanEdited: true,
        status: "draft",
        approvedAt: null,
        approvalRevokedAt: databaseNow(),
        updatedAt: databaseNow(),
      })
      .where(eq(outreach.id, outreachId))
      .returning();

    if (row === undefined) {
      throw new RecordNotFoundError("outreach", outreachId);
    }

    return row;
  }

  const permittedFrom: readonly OutreachRow["status"][] = textIsChanging
    ? (["draft", "pending_approval", "rejected"] as const)
    : (["draft", "pending_approval", "rejected", "approved"] as const);

  return transition(executor, outreachId, permittedFrom, {
    ...changes,
    isHumanEdited: textIsChanging || current.isHumanEdited,
  });
}

/**
 * Records that an approved message was transmitted.
 *
 * This does not transmit it. The record must already be approved — enforced
 * here, and again by a CHECK constraint, so a hand-written UPDATE cannot mark
 * an unapproved message as sent either.
 */
export async function markOutreachSent(
  executor: Executor,
  outreachId: string,
): Promise<OutreachRow> {
  return transition(executor, outreachId, ["approved"], {
    status: "sent",
    sentAt: databaseNow(),
  });
}

/** Records a reply. Only a sent message can be replied to. */
export async function recordOutreachResponse(
  executor: Executor,
  outreachId: string,
): Promise<OutreachRow> {
  return transition(executor, outreachId, ["sent"], {
    status: "replied",
    respondedAt: databaseNow(),
  });
}

/** Withdraws a message that has not been sent. */
export async function cancelOutreach(executor: Executor, outreachId: string): Promise<OutreachRow> {
  return transition(executor, outreachId, ["draft", "pending_approval", "approved"], {
    status: "cancelled",
  });
}

/**
 * Rejects an outreach record that is pending approval.
 *
 * Requires a non-blank reason. Once rejected, the record cannot be approved.
 */
export async function rejectOutreach(
  executor: Executor,
  outreachId: string,
  reason: string,
): Promise<OutreachRow> {
  const trimmed = reason.trim();

  if (trimmed.length === 0) {
    throw new WriteValidationError("Rejecting outreach", [
      "Expected a non-blank rejection reason.",
    ]);
  }

  return transition(executor, outreachId, ["pending_approval"], {
    status: "rejected",
    rejectionReason: trimmed,
    rejectedAt: databaseNow(),
  });
}

export async function listOutreach(
  executor: Executor,
  filters?: { status?: OutreachRow["status"]; leadId?: string },
): Promise<OutreachRow[]> {
  const conditions: (
    | ReturnType<typeof eq<typeof outreach.status>>
    | ReturnType<typeof eq<typeof outreach.leadId>>
  )[] = [];
  if (filters?.status !== undefined) {
    conditions.push(eq(outreach.status, filters.status));
  }
  if (filters?.leadId !== undefined) {
    conditions.push(eq(outreach.leadId, filters.leadId));
  }

  const whereClause =
    conditions.length > 0
      ? conditions.length === 1
        ? conditions[0]
        : and(...conditions)
      : undefined;

  return executor.select().from(outreach).where(whereClause);
}

type OutreachChanges = Assignments<typeof outreach.$inferInsert> & {
  readonly status?: OutreachRow["status"];
};

async function transition(
  executor: Executor,
  outreachId: string,
  permittedFrom: readonly OutreachRow["status"][],
  changes: OutreachChanges,
): Promise<OutreachRow> {
  const [current] = await executor
    .select({ status: outreach.status })
    .from(outreach)
    .where(eq(outreach.id, outreachId))
    .limit(1);

  if (current === undefined) {
    throw new RecordNotFoundError("outreach", outreachId);
  }

  if (!permittedFrom.includes(current.status)) {
    throw new WriteValidationError("The outreach state change", [
      `Outreach ${outreachId} is "${current.status}"; "${changes.status}" is reachable only from ${permittedFrom.join(", ")}.`,
    ]);
  }

  const [row] = await executor
    .update(outreach)
    .set({ ...changes, updatedAt: databaseNow() })
    .where(eq(outreach.id, outreachId))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("outreach", outreachId);
  }

  return row;
}
