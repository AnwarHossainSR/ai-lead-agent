import { z } from "zod";

import { ConfigurationError, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { identifierSchema } from "../internal/identifier";

/**
 * The lead lifecycle. Order is meaningful only for display; what a lead may do
 * next is decided entirely by the transition map below, never by position.
 */
const STATUS_DATA = [
  "discovered",
  "verified",
  "analyzing",
  "qualified",
  "high_priority",
  "contacted",
  "replied",
  "interested",
  "meeting",
  "proposal",
  "won",
  "lost",
  "not_interested",
  "rejected",
] as const;

/** Statuses a lead never leaves. Their transition sets must be empty. */
const TERMINAL_STATUS_DATA = ["won", "lost", "not_interested", "rejected"] as const;

const TRANSITION_DATA = {
  // Research pipeline. `rejected` is the escape hatch at every research stage:
  // a company that turns out not to be a fit leaves the pipeline here.
  discovered: ["verified", "rejected"],
  verified: ["analyzing", "rejected"],
  analyzing: ["qualified", "rejected"],
  qualified: ["high_priority", "contacted", "rejected"],
  high_priority: ["contacted", "rejected"],

  // Outreach. Every sales stage can end in `lost` or `not_interested`.
  contacted: ["replied", "not_interested", "lost"],
  replied: ["interested", "not_interested", "lost"],
  interested: ["meeting", "not_interested", "lost"],
  meeting: ["proposal", "not_interested", "lost"],
  proposal: ["won", "lost", "not_interested"],

  // Terminal.
  won: [],
  lost: [],
  not_interested: [],
  rejected: [],
} as const;

const INITIAL_STATUS_DATA = "discovered";

export const leadStatusSchema = identifierSchema;

export const lifecycleSchema = z.object({
  statuses: z.array(leadStatusSchema).min(1, "Expected at least one lead status."),
  terminalStatuses: z.array(leadStatusSchema),
  transitions: z.record(leadStatusSchema, z.array(leadStatusSchema)),
  initialStatus: leadStatusSchema,
});

export interface Lifecycle {
  readonly statuses: readonly string[];
  readonly terminalStatuses: readonly string[];
  readonly transitions: Readonly<Record<string, readonly string[]>>;
  readonly initialStatus: string;
}

const SUBJECT = "Lead lifecycle configuration";

/**
 * Validates a lifecycle definition: every status has a transition set, every
 * transition target is a known status, terminal statuses lead nowhere, and
 * every non-terminal status leads somewhere.
 */
export function parseLifecycle(raw: unknown): Lifecycle {
  const lifecycle = parseOrThrow(SUBJECT, lifecycleSchema, raw);
  const statuses = new Set(lifecycle.statuses);

  if (statuses.size !== lifecycle.statuses.length) {
    throw new ConfigurationError(SUBJECT, "The status list contains a duplicate.");
  }

  if (!statuses.has(lifecycle.initialStatus)) {
    throw new ConfigurationError(
      SUBJECT,
      `Initial status "${lifecycle.initialStatus}" is not a configured status.`,
    );
  }

  for (const terminal of lifecycle.terminalStatuses) {
    if (!statuses.has(terminal)) {
      throw new ConfigurationError(
        SUBJECT,
        `Terminal status "${terminal}" is not a configured status.`,
      );
    }
  }

  const terminal = new Set(lifecycle.terminalStatuses);

  for (const status of lifecycle.statuses) {
    const targets = lifecycle.transitions[status];

    if (targets === undefined) {
      throw new ConfigurationError(SUBJECT, `Status "${status}" has no transition set.`);
    }

    for (const target of targets) {
      if (!statuses.has(target)) {
        throw new ConfigurationError(
          SUBJECT,
          `Transition "${status}" -> "${target}" names a target that is not a configured status.`,
        );
      }
    }

    if (terminal.has(status) && targets.length > 0) {
      throw new ConfigurationError(
        SUBJECT,
        `Terminal status "${status}" must have no outbound transitions, but names ${targets.join(", ")}.`,
      );
    }

    if (!terminal.has(status) && targets.length === 0) {
      throw new ConfigurationError(
        SUBJECT,
        `Status "${status}" has no outbound transitions but is not declared terminal.`,
      );
    }
  }

  for (const source of Object.keys(lifecycle.transitions)) {
    if (!statuses.has(source)) {
      throw new ConfigurationError(
        SUBJECT,
        `Transition set declared for "${source}", which is not a configured status.`,
      );
    }
  }

  return deepFreeze(lifecycle);
}

export const LIFECYCLE = parseLifecycle({
  statuses: STATUS_DATA,
  terminalStatuses: TERMINAL_STATUS_DATA,
  transitions: TRANSITION_DATA,
  initialStatus: INITIAL_STATUS_DATA,
});

export type LeadStatus = (typeof STATUS_DATA)[number];
export type TerminalLeadStatus = (typeof TERMINAL_STATUS_DATA)[number];

export const LEAD_STATUSES = LIFECYCLE.statuses as readonly LeadStatus[];
export const TERMINAL_LEAD_STATUSES = LIFECYCLE.terminalStatuses as readonly TerminalLeadStatus[];
export const INITIAL_LEAD_STATUS: LeadStatus = INITIAL_STATUS_DATA;

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

function assertKnownStatus(role: string, value: string): asserts value is LeadStatus {
  if (!isLeadStatus(value)) {
    throw new ConfigurationError(
      SUBJECT,
      `Unknown ${role} status "${value}". Configured statuses: ${LEAD_STATUSES.join(", ")}.`,
    );
  }
}

/**
 * The statuses a lead in `from` may move to. Terminal statuses return an empty
 * list; an unknown status is refused rather than treated as terminal.
 */
export function permittedTransitions(from: string): readonly LeadStatus[] {
  assertKnownStatus("source", from);
  return (LIFECYCLE.transitions[from] ?? []) as readonly LeadStatus[];
}

/** Whether a lead may move from `from` to `to`. Unknown statuses are refused. */
export function canTransition(from: string, to: string): boolean {
  assertKnownStatus("source", from);
  assertKnownStatus("target", to);
  return permittedTransitions(from).includes(to);
}

/** Raised when a lead is asked to make a transition the lifecycle forbids. */
export class LeadStatusTransitionError extends Error {
  readonly from: LeadStatus;
  readonly to: LeadStatus;
  readonly permitted: readonly LeadStatus[];

  constructor(from: LeadStatus, to: LeadStatus, permitted: readonly LeadStatus[]) {
    const allowed =
      permitted.length > 0
        ? `Permitted from "${from}": ${permitted.join(", ")}.`
        : `"${from}" is a terminal status and permits no transitions.`;

    super(`Cannot move a lead from "${from}" to "${to}". ${allowed}`);

    this.name = "LeadStatusTransitionError";
    this.from = from;
    this.to = to;
    this.permitted = permitted;
  }
}

/**
 * Throws unless the transition is permitted. Used by the write path so an
 * impermissible transition never reaches the database.
 */
export function assertTransition(from: string, to: string): void {
  assertKnownStatus("source", from);
  assertKnownStatus("target", to);

  if (!canTransition(from, to)) {
    throw new LeadStatusTransitionError(from, to, permittedTransitions(from));
  }
}
