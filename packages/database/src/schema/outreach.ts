import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { aiInvocations } from "./ai-invocations";
import { outreachChannelEnum, outreachStatusEnum } from "./enums";
import { leads } from "./leads";

/**
 * A drafted message to a lead.
 *
 * This table stores messages. It does not send them, and nothing in this
 * package can: there is no transport, no client and no scheduler here. What
 * the schema does guarantee is that a record cannot claim to have been sent
 * without a human approval behind it, and cannot claim to have been sent
 * before it was approved.
 *
 * Both constraints are in the database rather than in application code because
 * a future worker, a migration or a hand-written UPDATE would bypass anything
 * softer, and "was this approved?" is the one question this product cannot get
 * wrong.
 */
export const outreach = pgTable(
  "outreach",
  {
    id: uuid("id").primaryKey(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),

    channel: outreachChannelEnum("channel").notNull(),
    subject: text("subject"),
    messageBody: text("message_body").notNull(),
    status: outreachStatusEnum("status").notNull().default("draft"),

    generatedSubject: text("generated_subject"),
    generatedBody: text("generated_body"),
    isHumanEdited: boolean("is_human_edited").notNull().default(false),
    promptVersion: integer("prompt_version"),
    aiInvocationId: uuid("ai_invocation_id").references(() => aiInvocations.id, {
      onDelete: "restrict",
    }),
    citedFacts: jsonb("cited_facts").notNull().default("[]"),

    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    approvalRevokedAt: timestamp("approval_revoked_at", { withTimezone: true }),
    approvedTextHash: text("approved_text_hash"),

    rejectionReason: text("rejection_reason"),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),

    notes: text("notes"),

    isExample: boolean("is_example").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // A generated message must carry an invocation reference; a manually
    // created draft (no AI call) has no generated body.
    check(
      "outreach_generated_requires_invocation",
      sql`${table.generatedBody} IS NULL OR ${table.aiInvocationId} IS NOT NULL`,
    ),

    // A sent message must carry both the approval and the send. Statuses that
    // follow sending (`replied`, `bounced`) are covered too: they can only be
    // reached from `sent`, and a record that reaches them without the
    // timestamps would be a record with no evidence it was ever approved.
    check(
      "outreach_sent_requires_approval",
      sql`${table.status} NOT IN ('sent', 'replied', 'bounced')
        OR (${table.approvedAt} IS NOT NULL AND ${table.sentAt} IS NOT NULL)`,
    ),

    // A send timestamp without an approval timestamp is the same violation
    // written a different way; catching it here means the order holds even
    // while the status is still being moved.
    check(
      "outreach_sent_at_requires_approved_at",
      sql`${table.sentAt} IS NULL OR ${table.approvedAt} IS NOT NULL`,
    ),

    check(
      "outreach_sent_at_not_before_approved_at",
      sql`${table.sentAt} IS NULL OR ${table.approvedAt} IS NULL OR ${table.sentAt} >= ${table.approvedAt}`,
    ),

    check(
      "outreach_responded_at_requires_sent_at",
      sql`${table.respondedAt} IS NULL OR ${table.sentAt} IS NOT NULL`,
    ),

    // An approved record's text hash must match the hash of its current text.
    // This catches hand-written UPDATEs that change an approved message.
    check(
      "outreach_approved_text_hash_matches",
      sql`${table.status} <> 'approved' OR (${table.approvedTextHash} IS NOT NULL AND ${table.approvedTextHash} = md5(coalesce(${table.subject}, '') || E'\n' || ${table.messageBody}))`,
    ),

    // A rejection must carry a non-blank reason.
    check(
      "outreach_rejection_requires_reason",
      sql`${table.rejectedAt} IS NULL OR length(btrim(${table.rejectionReason})) > 0`,
    ),

    index("outreach_lead_status_idx").on(table.leadId, table.status),
  ],
);

export type OutreachRow = typeof outreach.$inferSelect;
export type OutreachInsert = typeof outreach.$inferInsert;
