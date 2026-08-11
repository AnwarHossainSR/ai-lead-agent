import {
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  OUTREACH_CHANNELS,
  type LeadPriority,
  type LeadStatus,
  type OutreachChannelId,
} from "@mela/config";
import { pgEnum } from "drizzle-orm/pg-core";

/**
 * PostgreSQL enum types.
 *
 * Design D4 splits the vocabulary in two. The sets here are stable and a bad
 * value corrupts the lifecycle, so the database itself refuses one. Countries,
 * cities, industries and services are designed to grow through configuration
 * edits, so they stay `text` and are validated by the write helpers instead —
 * otherwise every new city would need a migration.
 *
 * The values come from `@mela/config`, so the enum and the application share
 * one source. Adding a status there and regenerating produces a migration:
 * that migration is the visible cost of changing the lifecycle, which is the
 * point.
 */

/**
 * Drizzle's `pgEnum` wants a non-empty tuple of literals. The configuration
 * arrays are validated and frozen but typed as ordinary readonly arrays, so
 * the shape is asserted here — a compile error the moment a configured set
 * loses its first element.
 */
function toEnumValues<T extends string>(values: readonly T[]): [T, ...T[]] {
  const [first, ...rest] = values;

  if (first === undefined) {
    throw new Error("A PostgreSQL enum needs at least one value; the configured set was empty.");
  }

  return [first, ...rest];
}

export const leadStatusEnum = pgEnum("lead_status", toEnumValues<LeadStatus>(LEAD_STATUSES));

export const leadPriorityEnum = pgEnum(
  "lead_priority",
  toEnumValues<LeadPriority>(LEAD_PRIORITIES),
);

export const outreachChannelEnum = pgEnum(
  "outreach_channel",
  toEnumValues<OutreachChannelId>(
    OUTREACH_CHANNELS.map((channel) => channel.id as OutreachChannelId),
  ),
);

/**
 * Where an outreach message stands. `sent` is reachable only through a record
 * that already carries an approval timestamp — enforced by a CHECK constraint
 * on the table, not by convention.
 */
export const OUTREACH_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "replied",
  "bounced",
  "cancelled",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

export const outreachStatusEnum = pgEnum("outreach_status", OUTREACH_STATUSES);

/**
 * How well established a stored claim is. `observed` means it was seen at a
 * recorded URL; `inferred` means it was reasoned from evidence that is also
 * recorded. There is deliberately no third value for a guess — an unestablished
 * fact is absent (SQL NULL), never stored with a low certainty.
 */
export const CERTAINTIES = ["observed", "inferred"] as const;

export type Certainty = (typeof CERTAINTIES)[number];

export const certaintyEnum = pgEnum("certainty", CERTAINTIES);

/**
 * Outcome of one language model call (design D6). `succeeded` is a usable
 * result; the other three still cost money and are recorded so a high
 * failure or refusal rate is visible rather than invisible in a table of
 * successes only.
 */
export const AI_INVOCATION_OUTCOMES = [
  "succeeded",
  "invalid_output",
  "provider_error",
  "refused_by_ceiling",
] as const;

export type AIInvocationOutcome = (typeof AI_INVOCATION_OUTCOMES)[number];

export const aiInvocationOutcomeEnum = pgEnum("ai_invocation_outcome", AI_INVOCATION_OUTCOMES);
