import { LEAD_PRIORITIES, LEAD_STATUSES } from "@mela/config";
import { describe, expect, it } from "vitest";

import {
  TONE_MAPS,
  type Tone,
  healthTone,
  jobStateTone,
  leadPriorityTone,
  leadStatusTone,
  outreachStatusTone,
  stalenessTone,
  statusTone,
} from "./status-tone";

const TONES: readonly Tone[] = ["success", "warning", "danger", "info", "neutral"];

/** Mirrors the API's `OUTREACH_STATUSES`, which the web app does not import. */
const OUTREACH_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "sent",
  "replied",
  "bounced",
  "cancelled",
] as const;

const DISCOVERY_RUN_OUTCOMES = [
  "running",
  "succeeded",
  "partial",
  "limit_reached",
  "failed",
] as const;

const DISCOVERY_SOURCE_OUTCOMES = ["succeeded", "skipped", "blocked", "failed"] as const;

describe("status tones", () => {
  it("covers every configured lead priority", () => {
    for (const priority of LEAD_PRIORITIES) {
      expect(TONE_MAPS.leadPriority, `priority ${priority}`).toHaveProperty(priority);
      expect(TONES).toContain(leadPriorityTone(priority));
    }
  });

  it("covers every configured lead status", () => {
    for (const status of LEAD_STATUSES) {
      expect(TONE_MAPS.leadStatus, `status ${status}`).toHaveProperty(status);
      expect(TONES).toContain(leadStatusTone(status));
    }
  });

  it("covers every outreach status", () => {
    for (const status of OUTREACH_STATUSES) {
      expect(TONE_MAPS.outreachStatus, `status ${status}`).toHaveProperty(status);
      expect(TONES).toContain(outreachStatusTone(status));
    }
  });

  it("covers every discovery run and source outcome", () => {
    for (const outcome of [...DISCOVERY_RUN_OUTCOMES, ...DISCOVERY_SOURCE_OUTCOMES]) {
      expect(TONE_MAPS.jobState, `outcome ${outcome}`).toHaveProperty(outcome);
      expect(TONES).toContain(jobStateTone(outcome));
    }
  });

  it("covers every health status and dependency state", () => {
    for (const status of ["healthy", "degraded", "unreachable", "up", "down"]) {
      expect(TONE_MAPS.health, `health ${status}`).toHaveProperty(status);
      expect(TONES).toContain(healthTone(status));
    }
  });

  it("gives the terminal negative lead statuses the danger tone", () => {
    expect(leadStatusTone("lost")).toBe("danger");
    expect(leadStatusTone("not_interested")).toBe("danger");
    expect(leadStatusTone("rejected")).toBe("danger");
    expect(leadStatusTone("won")).toBe("success");
  });

  it("warns on the one outreach state waiting for a human", () => {
    expect(outreachStatusTone("pending_approval")).toBe("warning");
    expect(outreachStatusTone("sent")).toBe("success");
    expect(outreachStatusTone("bounced")).toBe("danger");
  });

  it("marks a stale score and leaves a fresh one neutral", () => {
    expect(stalenessTone(true)).toBe("warning");
    expect(stalenessTone(false)).toBe("neutral");
  });

  it("gives health, degradation and unreachability three different tones", () => {
    expect(healthTone("healthy")).toBe("success");
    expect(healthTone("degraded")).toBe("warning");
    expect(healthTone("unreachable")).toBe("danger");
  });

  it("falls back to neutral for an unrecognised value rather than throwing", () => {
    expect(leadPriorityTone("catastrophic")).toBe("neutral");
    expect(leadStatusTone("")).toBe("neutral");
    expect(outreachStatusTone("teleported")).toBe("neutral");
    expect(jobStateTone("unheard-of")).toBe("neutral");
    expect(healthTone("sideways")).toBe("neutral");
    expect(statusTone("leadStatus", "not-a-status")).toBe("neutral");
  });

  it("does not resolve a value inherited from Object.prototype", () => {
    expect(leadStatusTone("toString")).toBe("neutral");
    expect(leadStatusTone("constructor")).toBe("neutral");
  });

  it("resolves the same value to the same tone through every entry point", () => {
    expect(statusTone("leadPriority", "very_high")).toBe(leadPriorityTone("very_high"));
    expect(statusTone("outreachStatus", "sent")).toBe(outreachStatusTone("sent"));
    expect(statusTone("jobState", "failed")).toBe(jobStateTone("failed"));
  });
});
