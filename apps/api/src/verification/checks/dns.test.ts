import { describe, expect, it } from "vitest";

import { createDnsCheck, type Resolver } from "./dns";
import type { CheckInput } from "../types";

function input(overrides?: Partial<CheckInput>): CheckInput {
  return {
    companyId: "019ff21c-0000-7000-8000-000000000001",
    domain: "example.com",
    companyName: "Example Corp",
    timeoutMs: 5_000,
    ...overrides,
  };
}

function fakeResolver(overrides?: Partial<Resolver>): Resolver {
  return {
    resolve4: async () => ["1.2.3.4"],
    resolveMx: async () => [{ exchange: "mail.example.com", priority: 10 }],
    ...overrides,
  };
}

describe("dns check", () => {
  it("returns passed when the domain resolves to addresses", async () => {
    const check = createDnsCheck(fakeResolver());
    const result = await check.run(input());
    expect(result.verdict).toBe("passed");
    expect(result.evidence).toContain("1.2.3.4");
    expect(result.evidenceUrl).toBe("dns:example.com");
  });

  it("returns passed when only MX records exist", async () => {
    const check = createDnsCheck(
      fakeResolver({
        resolve4: async () => [],
        resolveMx: async () => [{ exchange: "mail.example.com", priority: 10 }],
      }),
    );
    const result = await check.run(input());
    expect(result.verdict).toBe("passed");
    expect(result.evidence).toContain("MX");
  });

  it("returns failed when no records exist", async () => {
    const check = createDnsCheck(
      fakeResolver({
        resolve4: async () => [],
        resolveMx: async () => [],
      }),
    );
    const result = await check.run(input());
    expect(result.verdict).toBe("failed");
    expect(result.evidence).toContain("no A, AAAA, or MX records");
  });

  it("returns failed on NXDOMAIN", async () => {
    const error = new Error("queryAENOTFOUND") as Error & { code: string };
    error.code = "ENOTFOUND";
    const check = createDnsCheck(
      fakeResolver({
        resolve4: async () => {
          throw error;
        },
        resolveMx: async () => {
          throw error;
        },
      }),
    );
    const result = await check.run(input());
    expect(result.verdict).toBe("failed");
    expect(result.evidence).toContain("does not exist");
  });

  it("returns unknown when the resolver itself fails", async () => {
    const check = createDnsCheck(
      fakeResolver({
        resolve4: async () => {
          throw new Error("ECONNREFUSED");
        },
        resolveMx: async () => {
          throw new Error("ECONNREFUSED");
        },
      }),
    );
    const result = await check.run(input());
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("resolver_error");
  });

  it("returns unknown on timeout", async () => {
    const check = createDnsCheck(
      fakeResolver({
        resolve4: async () => new Promise<string[]>((resolve) => setTimeout(() => resolve(["1.2.3.4"]), 10_000)),
        resolveMx: async () => [],
      }),
    );
    const result = await check.run(input({ timeoutMs: 50 }));
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("timeout");
  });
});

