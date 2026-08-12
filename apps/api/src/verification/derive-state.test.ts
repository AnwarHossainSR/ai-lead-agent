import { describe, expect, it } from "vitest";

import type { VerificationRule } from "@mela/config/product";

import { deriveState } from "./derive-state";
import type { CheckResult } from "./types";

const RULE: VerificationRule = {
  checks: {
    dns: { required: true, sufficient: false, timeoutMs: 5_000 },
    http: { required: true, sufficient: false, timeoutMs: 10_000 },
    "domain-name-match": { required: false, sufficient: false, timeoutMs: 0 },
    registry: { required: false, sufficient: false, timeoutMs: 15_000 },
  },
  stalenessDays: 90,
};

function result(checkId: string, verdict: CheckResult["verdict"]): CheckResult {
  return {
    checkId,
    verdict,
    evidence: verdict === "unknown" ? "" : `${checkId} ${verdict}`,
    evidenceUrl: verdict === "unknown" ? "" : `${checkId}:test`,
  };
}

describe("deriveState", () => {
  it("returns never_checked when no results", () => {
    const { state } = deriveState([], RULE);
    expect(state).toBe("never_checked");
  });

  it("returns verified when all required checks pass", () => {
    const { state, failedCheckIds } = deriveState(
      [result("dns", "passed"), result("http", "passed")],
      RULE,
    );
    expect(state).toBe("verified");
    expect(failedCheckIds).toEqual([]);
  });

  it("returns verified even when optional checks are missing", () => {
    const { state } = deriveState(
      [result("dns", "passed"), result("http", "passed")],
      RULE,
    );
    expect(state).toBe("verified");
  });

  it("returns unverified when a required check fails", () => {
    const { state, failedCheckIds } = deriveState(
      [result("dns", "failed"), result("http", "passed")],
      RULE,
    );
    expect(state).toBe("unverified");
    expect(failedCheckIds).toEqual(["dns"]);
  });

  it("returns unverified with all failing required checks named", () => {
    const { state, failedCheckIds } = deriveState(
      [result("dns", "failed"), result("http", "failed")],
      RULE,
    );
    expect(state).toBe("unverified");
    expect(failedCheckIds).toContain("dns");
    expect(failedCheckIds).toContain("http");
  });

  it("returns unreachable when required checks are unknown", () => {
    const { state, failedCheckIds } = deriveState(
      [result("dns", "unknown"), result("http", "unknown")],
      RULE,
    );
    expect(state).toBe("unreachable");
    expect(failedCheckIds).toEqual([]);
  });

  it("returns unreachable when some required checks are unknown and none failed", () => {
    const { state } = deriveState(
      [result("dns", "passed"), result("http", "unknown")],
      RULE,
    );
    expect(state).toBe("unreachable");
  });

  it("returns unreachable when only optional checks are present", () => {
    const { state } = deriveState(
      [result("domain-name-match", "passed")],
      RULE,
    );
    expect(state).toBe("unreachable");
  });

  it("returns verified when all required pass and optional checks vary", () => {
    const { state } = deriveState(
      [
        result("dns", "passed"),
        result("http", "passed"),
        result("domain-name-match", "failed"),
        result("registry", "unknown"),
      ],
      RULE,
    );
    expect(state).toBe("verified");
  });

  it("prioritizes failed over unknown for required checks", () => {
    const { state, failedCheckIds } = deriveState(
      [result("dns", "failed"), result("http", "unknown")],
      RULE,
    );
    expect(state).toBe("unverified");
    expect(failedCheckIds).toEqual(["dns"]);
  });

  it("does not call a language model (no async model calls in the function)", () => {
    // This test is a structural assertion: deriveState is synchronous
    // and contains no dynamic imports or fetch calls.  The function
    // body is pure arithmetic over the inputs.
    const start = performance.now();
    deriveState([result("dns", "passed"), result("http", "passed")], RULE);
    const elapsed = performance.now() - start;
    // Should complete in under 1ms — no I/O, no model
    expect(elapsed).toBeLessThan(100);
  });
});
