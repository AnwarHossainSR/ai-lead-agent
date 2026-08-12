import { describe, expect, it } from "vitest";

import type { RegistryConfig } from "@mela/config";

import type { CheckInput } from "../types";
import { type RegistryClient, createRegistryCheck } from "./registry";

function input(overrides?: Partial<CheckInput>): CheckInput {
  return {
    companyId: "019ff21c-0000-7000-8000-000000000001",
    domain: "example.com",
    companyName: "Example Corp",
    timeoutMs: 15_000,
    ...overrides,
  };
}

const UAE_CONFIG: RegistryConfig = {
  countryId: "uae",
  baseUrl: "https://registry.example.ae",
  searchPath: "/search?q={query}",
};

function fakeClient(overrides?: Partial<RegistryClient>): RegistryClient {
  return {
    fetch: async () => ({ status: 200, body: '{"results": []}' }),
    ...overrides,
  };
}

describe("registry check", () => {
  it("returns unknown when no country is provided", async () => {
    const check = createRegistryCheck([UAE_CONFIG], fakeClient());
    const result = await check.run(input());
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("no_country");
  });

  it("returns unknown when no registry is configured for the country", async () => {
    const check = createRegistryCheck([UAE_CONFIG], fakeClient());
    const result = await check.run(input(), "sa");
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("no_registry");
  });

  it("returns passed when the company is found in the registry", async () => {
    const check = createRegistryCheck(
      [UAE_CONFIG],
      fakeClient({
        fetch: async () => ({
          status: 200,
          body: JSON.stringify({ company: "Example Corp" }),
        }),
      }),
    );
    const result = await check.run(input(), "uae");
    expect(result.verdict).toBe("passed");
    expect(result.evidence).toContain("Example Corp");
    expect(result.evidenceUrl).toContain("registry.example.ae");
  });

  it("returns failed when the company is not found", async () => {
    const check = createRegistryCheck(
      [UAE_CONFIG],
      fakeClient({
        fetch: async () => ({
          status: 200,
          body: JSON.stringify({ results: [] }),
        }),
      }),
    );
    const result = await check.run(input(), "uae");
    expect(result.verdict).toBe("failed");
    expect(result.evidence).toContain("not found");
  });

  it("returns unknown on registry HTTP error", async () => {
    const check = createRegistryCheck(
      [UAE_CONFIG],
      fakeClient({
        fetch: async () => ({ status: 500, body: "error" }),
      }),
    );
    const result = await check.run(input(), "uae");
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("unusable_response");
  });

  it("returns unknown when the fetch throws", async () => {
    const check = createRegistryCheck(
      [UAE_CONFIG],
      fakeClient({
        fetch: async () => {
          throw new Error("network error");
        },
      }),
    );
    const result = await check.run(input(), "uae");
    expect(result.verdict).toBe("unknown");
    expect(result.failureCode).toBe("unusable_response");
  });

  it("always carries evidence or failureCode", async () => {
    const check = createRegistryCheck([UAE_CONFIG], fakeClient());
    const passed = await check.run(input(), "uae");
    const unknown = await check.run(input(), "sa");
    expect(passed.evidence.length + (passed.failureCode?.length ?? 0)).toBeGreaterThan(0);
    expect(unknown.failureCode).toBeTruthy();
  });
});
