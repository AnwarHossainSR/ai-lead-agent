import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { aiInvocations } from "./ai-invocations";
import { outreachResponseKindEnum } from "./enums";
import { outreach } from "./outreach";

/**
 * One recorded response to an outreach message.
 *
 * Each row is an event: a reply arrived, a bounce was received, the contact
 * unsubscribed, or the configured interval elapsed with no reply. The table
 * is append-only; nothing here is ever updated.
 */
export const outreachResponses = pgTable(
  "outreach_responses",
  {
    id: uuid("id").primaryKey(),
    outreachId: uuid("outreach_id")
      .notNull()
      .references(() => outreach.id, { onDelete: "cascade" }),

    kind: outreachResponseKindEnum("kind").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    body: text("body"),

    proposedCategoryId: text("proposed_category_id"),
    confirmedCategoryId: text("confirmed_category_id").notNull(),

    aiInvocationId: uuid("ai_invocation_id").references(() => aiInvocations.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("outreach_responses_outreach_id_idx").on(table.outreachId, table.receivedAt.desc()),
  ],
);

export type OutreachResponseRow = typeof outreachResponses.$inferSelect;
export type OutreachResponseInsert = typeof outreachResponses.$inferInsert;
