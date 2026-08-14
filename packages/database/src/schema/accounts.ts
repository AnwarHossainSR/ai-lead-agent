import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { accountRoleEnum } from "./enums";

/**
 * An operator account (design D2/D4).
 *
 * There is no public sign-up: every row here was created by an existing
 * operator or by the documented command. An account is disabled, never
 * deleted — `disabled_at` rather than a row removal — because deleting it
 * would erase the record of who approved a message that reached a real
 * company (design D5). Every table that attributes a consequential action
 * references this one with `ON DELETE RESTRICT` for exactly that reason.
 */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: accountRoleEnum("role").notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("accounts_email_key").on(table.email)],
);

export type AccountRow = typeof accounts.$inferSelect;
export type AccountInsert = typeof accounts.$inferInsert;
