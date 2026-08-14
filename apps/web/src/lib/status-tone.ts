/**
 * Status semantics in one place (design D3).
 *
 * Every domain status the workspace renders resolves to one of five semantic
 * tones, so the same meaning is the same colour on every screen. Components take
 * a tone; nothing takes a colour. An unrecognised value resolves to `neutral`
 * rather than throwing — a status added to the API before the UI knows about it
 * must render plainly, never crash a page.
 */

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

function lookup(map: Readonly<Record<string, Tone>>, value: string): Tone {
  // `Object.hasOwn`, not a plain index: a status called "toString" would
  // otherwise resolve to an inherited function rather than to a tone.
  return Object.hasOwn(map, value) ? (map[value] as Tone) : "neutral";
}

/** Lead priority bands (`@mela/config` PRIORITY_BANDS). */
const LEAD_PRIORITY_TONES: Readonly<Record<string, Tone>> = {
  very_high: "success",
  high: "info",
  medium: "neutral",
  low: "neutral",
};

export function leadPriorityTone(priority: string): Tone {
  return lookup(LEAD_PRIORITY_TONES, priority);
}

/**
 * Lead lifecycle statuses. Research stages are neutral — they say where a lead
 * is, not whether anything is wrong; engagement stages are informational; `won`
 * is the only success, and the four terminal negatives are danger.
 */
const LEAD_STATUS_TONES: Readonly<Record<string, Tone>> = {
  discovered: "neutral",
  verified: "neutral",
  analyzing: "neutral",
  qualified: "info",
  high_priority: "info",
  contacted: "info",
  replied: "info",
  interested: "info",
  meeting: "info",
  proposal: "info",
  won: "success",
  lost: "danger",
  not_interested: "danger",
  rejected: "danger",
};

export function leadStatusTone(status: string): Tone {
  return lookup(LEAD_STATUS_TONES, status);
}

/**
 * Outreach message statuses. `pending_approval` is warning because it is the
 * one state waiting on a human — the product's central rule.
 */
const OUTREACH_STATUS_TONES: Readonly<Record<string, Tone>> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "info",
  sent: "success",
  replied: "success",
  rejected: "danger",
  bounced: "danger",
  cancelled: "neutral",
};

export function outreachStatusTone(status: string): Tone {
  return lookup(OUTREACH_STATUS_TONES, status);
}

/** A lead whose score is older than the staleness threshold. */
export function stalenessTone(isStale: boolean): Tone {
  return isStale ? "warning" : "neutral";
}

/**
 * Job and run state: discovery run outcomes, per-source outcomes, and the
 * dead-letter states the operations page renders.
 */
const JOB_STATE_TONES: Readonly<Record<string, Tone>> = {
  running: "info",
  queued: "neutral",
  succeeded: "success",
  partial: "warning",
  limit_reached: "warning",
  skipped: "neutral",
  blocked: "warning",
  retrying: "warning",
  failed: "danger",
  dead_letter: "danger",
};

export function jobStateTone(state: string): Tone {
  return lookup(JOB_STATE_TONES, state);
}

/** API health (`HealthStatus["status"]`) and a dependency's up/down state. */
const HEALTH_TONES: Readonly<Record<string, Tone>> = {
  healthy: "success",
  up: "success",
  degraded: "warning",
  unreachable: "danger",
  down: "danger",
};

export function healthTone(status: string): Tone {
  return lookup(HEALTH_TONES, status);
}

/**
 * Every domain map, keyed by the domain it covers. Exported so a test can walk
 * the whole vocabulary, and so a caller that only has a domain name at runtime
 * does not have to switch over the functions above.
 */
export const TONE_MAPS = {
  leadPriority: LEAD_PRIORITY_TONES,
  leadStatus: LEAD_STATUS_TONES,
  outreachStatus: OUTREACH_STATUS_TONES,
  jobState: JOB_STATE_TONES,
  health: HEALTH_TONES,
} as const;

export type ToneDomain = keyof typeof TONE_MAPS;

export function statusTone(domain: ToneDomain, value: string): Tone {
  return lookup(TONE_MAPS[domain], value);
}
