import { describe, expect, it } from "vitest";

import { createDomainNameMatchCheck } from "./domain-name-match";
import type { CheckInput } from "../types";

function input(overrides?: Partial<CheckInput>): CheckInput {
  return {
    companyId: "019ff21c-0000-7000-8000-000000000001",
    domain: "example.com",
    companyName: "Example Corp",
    timeoutMs: 0,
    ...overrides,
  };
}

describe("domain-name-match check", () => {
  it("returns passed when tokens overlap", async () => {
    const check = createDomainNameMatchCheck();
    const result = await check.run(input());
    expect(result.verdict).toBe("passed");
    expect(result.evidence).toContain("example");
  });

  it("returns passed for partial token match", async () => {
    const check = createDomainNameMatchCheck();
    const result = await check.run(
      input({ companyName: "Al Noor Trading", domain: "noor-trading.com" }),
    );
    expect(result.verdict).toBe("passed");
    expect(result.evidence).toContain("noor");
  });

  it("returns failed when no tokens overlap", async () => {
    const check = createDomainNameMatchCheck();
    const result = await check.run(
      input({ companyName: "Acme Corp", domain: "widgets.com" }),
    );
    expect(result.verdict).toBe("failed");
    expect(result.evidence).toContain("No overlapping tokens");
  });

  it("ignores tokens shorter than 2 characters", async () => {
    const check = createDomainNameMatchCheck();
    const result = await check.run(
      input({ companyName: "A B C", domain: "abc.com" }),
    );
    // "a", "b", "c" are all < 2 chars, so no overlap
    expect(result.verdict).toBe("failed");
  });

  it("is case-insensitive", async () => {
    const check = createDomainNameMatchCheck();
    const result = await check.run(
      input({ companyName: "EXAMPLE Corp", domain: "EXAMPLE.com" }),
    );
    expect(result.verdict).toBe("passed");
  });

  it("always carries evidence", async () => {
    const check = createDomainNameMatchCheck();
    const passed = await check.run(input());
    const failed = await check.run(input({ companyName: "X", domain: "y.z" }));
    expect(passed.evidence.length).toBeGreaterThan(0);
    expect(passed.evidenceUrl.length).toBeGreaterThan(0);
    expect(failed.evidence.length).toBeGreaterThan(0);
    expect(failed.evidenceUrl.length).toBeGreaterThan(0);
  });
});

