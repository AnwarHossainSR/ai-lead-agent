import { describe, expect, it } from "vitest";

import { enforceEvidenceRequirement } from "./guard";
import type { CheckResult } from "./types";

function passed(overrides?: Partial<CheckResult>): CheckResult {
  return {
    checkId: "dns",
    verdict: "passed",
    evidence: "Resolved to 1.2.3.4",
    evidenceUrl: "dns:example.com",
    ...overrides,
  };
}

function failed(overrides?: Partial<CheckResult>): CheckResult {
  return {
    checkId: "dns",
    verdict: "failed",
    evidence: "NXDOMAIN",
    evidenceUrl: "dns:example.com",
    ...overrides,
  };
}

function unknown(overrides?: Partial<CheckResult>): CheckResult {
  return {
    checkId: "dns",
    verdict: "unknown",
    evidence: "",
    evidenceUrl: "",
    failureCode: "timeout",
    ...overrides,
  };
}

describe("enforceEvidenceRequirement", () => {
  it("passes through a passed verdict with evidence", () => {
    const result = enforceEvidenceRequirement(passed());
    expect(result.verdict).toBe("passed");
    expect(result.evidence).toBe("Resolved to 1.2.3.4");
  });

  it("passes through a failed verdict with evidence", () => {
    const result = enforceEvidenceRequirement(failed());
    expect(result.verdict).toBe("failed");
    expect(result.evidence).toBe("NXDOMAIN");
  });

  it("passes through an unknown verdict unchanged", () => {
    const result = enforceEvidenceRequirement(unknown());
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("timeout");
  });

  it("downgrades a passed verdict without evidence to unknown", () => {
    const result = enforceEvidenceRequirement(passed({ evidence: "", evidenceUrl: "" }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("missing_evidence");
    expect(result.evidence).toContain("Downgraded from passed");
  });

  it("downgrades a failed verdict without evidence to unknown", () => {
    const result = enforceEvidenceRequirement(failed({ evidence: "", evidenceUrl: "" }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("missing_evidence");
    expect(result.evidence).toContain("Downgraded from failed");
  });

  it("downgrades when evidence is blank but evidenceUrl exists", () => {
    const result = enforceEvidenceRequirement(passed({ evidence: "   ", evidenceUrl: "dns:x" }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("missing_evidence");
  });

  it("downgrades when evidenceUrl is blank but evidence exists", () => {
    const result = enforceEvidenceRequirement(passed({ evidence: "ok", evidenceUrl: "  " }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("missing_evidence");
  });

  it("preserves the checkId through downgrade", () => {
    const result = enforceEvidenceRequirement(
      passed({ checkId: "http", evidence: "", evidenceUrl: "" }),
    );
    expect(result.checkId).toBe("http");
  });
});
