import { createHash } from "node:crypto";
import { OUTREACH_CHANNELS, type OutreachChannelId } from "@mela/config";
import { type SQL, and, count, desc, eq, gte } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type OutreachRow, outreach } from "../schema/outreach";
import { type OutreachResponseInsert, outreachResponses } from "../schema/outreach-responses";
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
  means: string,
): Promise<OutreachRow> {
  return transition(executor, outreachId, ["approved"], {
    status: "sent",
    sentAt: databaseNow(),
    sentMeans: means,
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

export interface OutreachFilters {
  readonly status?: OutreachRow["status"];
  readonly leadId?: string;
  /** Keeps only records sent at or after this time. */
  readonly sentAfter?: Date;
}

export interface ListOutreachFilters extends OutreachFilters {
  readonly limit?: number;
  readonly offset?: number;
}

/** Shared by listOutreach and countOutreach, so the two never disagree about what a filter means. */
function buildOutreachConditions(filters?: OutreachFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters?.status !== undefined) {
    conditions.push(eq(outreach.status, filters.status));
  }
  if (filters?.leadId !== undefined) {
    conditions.push(eq(outreach.leadId, filters.leadId));
  }
  if (filters?.sentAfter !== undefined) {
    conditions.push(gte(outreach.sentAt, filters.sentAfter));
  }

  return conditions;
}

export async function countOutreach(
  executor: Executor,
  filters?: OutreachFilters,
): Promise<number> {
  const conditions = buildOutreachConditions(filters);

  const [row] = await executor
    .select({ value: count() })
    .from(outreach)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return row?.value ?? 0;
}

/**
 * Newest first: the review queue works through what needs attention now, and
 * a stale draft sitting at the bottom of an ascending list is easy to forget.
 */
export async function listOutreach(
  executor: Executor,
  filters?: ListOutreachFilters,
): Promise<OutreachRow[]> {
  const conditions = buildOutreachConditions(filters);

  let query = executor
    .select()
    .from(outreach)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(outreach.createdAt));

  if (filters?.limit !== undefined) {
    query = query.limit(filters.limit) as typeof query;
  }
  if (filters?.offset !== undefined) {
    query = query.offset(filters.offset) as typeof query;
  }

  return query;
}

export const recordOutreachSendInputSchema = z.object({
  outreachId: z.string().uuid("Expected the outreach identifier."),
  sentAt: z.coerce.date("Expected the send time."),
  means: z.string().trim().min(1, "Expected the send means."),
});

export type RecordOutreachSendInput = z.input<typeof recordOutreachSendInputSchema>;

/**
 * Records that an approved message was transmitted, with the time and means
 * supplied by the caller.
 *
 * This does not transmit it. The record must already be approved — enforced
 * here, and again by a CHECK constraint, so a hand-written UPDATE cannot mark
 * an unapproved message as sent either.
 */
export async function recordOutreachSend(
  executor: Executor,
  input: RecordOutreachSendInput,
): Promise<OutreachRow> {
  const value = parseInput("The outreach send", recordOutreachSendInputSchema, input);

  const [current] = await executor
    .select({ status: outreach.status, approvedAt: outreach.approvedAt })
    .from(outreach)
    .where(eq(outreach.id, value.outreachId))
    .limit(1);

  if (current === undefined) {
    throw new RecordNotFoundError("outreach", value.outreachId);
  }

  if (current.status !== "approved") {
    throw new WriteValidationError("Recording an outreach send", [
      `Outreach ${value.outreachId} is "${current.status}"; sending is reachable only from approved.`,
    ]);
  }

  if (current.approvedAt !== null && value.sentAt < current.approvedAt) {
    throw new WriteValidationError("Recording an outreach send", [
      `Outreach ${value.outreachId} send time ${value.sentAt.toISOString()} is earlier than approval time ${current.approvedAt.toISOString()}.`,
    ]);
  }

  const [row] = await executor
    .update(outreach)
    .set({
      status: "sent",
      sentAt: value.sentAt,
      sentMeans: value.means,
      updatedAt: databaseNow(),
    })
    .where(eq(outreach.id, value.outreachId))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("outreach", value.outreachId);
  }

  return row;
}

export const insertOutreachResponseInputSchema = z.object({
  outreachId: z.string().uuid("Expected the outreach identifier."),
  kind: z.enum(["replied", "bounced", "unsubscribed", "no_response"]),
  receivedAt: z.coerce.date("Expected the response time."),
  body: z.string().trim().min(1, "Expected the response text or nothing at all.").nullish(),
  proposedCategoryId: z
    .string()
    .trim()
    .min(1, "Expected a category identifier or nothing.")
    .nullish(),
  confirmedCategoryId: z.string().trim().min(1, "Expected the confirmed category."),
  aiInvocationId: z.string().uuid("Expected the AI invocation identifier.").nullish(),
});

export type InsertOutreachResponseInput = z.input<typeof insertOutreachResponseInputSchema>;

/**
 * Records a response event against a sent outreach message.
 *
 * The response kind, time and optional text are stored in `outreach_responses`.
 * The outreach record itself is not moved to `replied` here; that transition
 * happens separately when the confirmed category is applied.
 */
export async function insertOutreachResponse(
  executor: Executor,
  input: InsertOutreachResponseInput,
): Promise<OutreachResponseInsert> {
  const value = parseInput("The outreach response", insertOutreachResponseInputSchema, input);

  const [current] = await executor
    .select({ status: outreach.status, sentAt: outreach.sentAt })
    .from(outreach)
    .where(eq(outreach.id, value.outreachId))
    .limit(1);

  if (current === undefined) {
    throw new RecordNotFoundError("outreach", value.outreachId);
  }

  if (current.status !== "sent") {
    throw new WriteValidationError("Recording an outreach response", [
      `Outreach ${value.outreachId} is "${current.status}"; a response is recordable only from sent.`,
    ]);
  }

  const [row] = await executor
    .insert(outreachResponses)
    .values({
      id: uuidv7(),
      outreachId: value.outreachId,
      kind: value.kind,
      receivedAt: value.receivedAt,
      body: value.body ?? null,
      proposedCategoryId: value.proposedCategoryId ?? null,
      confirmedCategoryId: value.confirmedCategoryId,
      aiInvocationId: value.aiInvocationId ?? null,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The outreach response insert returned no row.");
  }

  return row;
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
