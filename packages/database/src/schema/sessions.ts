import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";

/**
 * A server-side session record (design D2).
 *
 * `token_hash` stores an HMAC of the opaque token issued in the cookie, never
 * the token itself — a database read (a backup, a replica, a careless query
 * in a support tool) cannot be turned into a working session. Expiry and
 * revocation are independent columns rather than one "ended" flag, because
 * the two are distinguishable states (developer-environment /
 * authentication spec) with different causes: one is time, the other is a
 * deliberate act.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_key").on(table.tokenHash),
    index("sessions_account_id_idx").on(table.accountId),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
export type SessionInsert = typeof sessions.$inferInsert;
