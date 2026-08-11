import { OUTREACH_CHANNELS, type OutreachChannelId } from "@mela/config";
import { eq } from "drizzle-orm";
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
      messageBody: value.messageBody,
      status: "draft",
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
  return transition(executor, outreachId, ["draft", "pending_approval"], {
    status: "approved",
    approvedAt: databaseNow(),
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

type OutreachChanges = Assignments<typeof outreach.$inferInsert> & {
  readonly status: OutreachRow["status"];
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
