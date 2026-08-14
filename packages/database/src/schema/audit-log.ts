import { index, inet, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";

/**
 * An append-only record of authentication events and consequential actions
 * (design D6).
 *
 * `account_id` is `ON DELETE SET NULL` even though accounts are never
 * deleted in practice — belt and braces so a row survives regardless.
 * `detail` never carries a password, a hash, a session id or a model prompt
 * (enforced by the audit writer, tested directly). The append-only guarantee
 * itself is not expressible in Drizzle's schema DSL: a trigger rejecting
 * `UPDATE` and `DELETE` on this table is created by raw SQL in the migration
 * and re-asserted in the integration tests.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    event: text("event").notNull(),
    subjectType: text("subject_type"),
    subjectId: uuid("subject_id"),
    outcome: text("outcome").notNull(),
    sourceAddress: inet("source_address"),
    detail: jsonb("detail").notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_account_id_idx").on(table.accountId),
    index("audit_log_event_created_at_idx").on(table.event, table.createdAt),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type AuditLogInsert = typeof auditLog.$inferInsert;
