import { describe, expect, it } from "vitest";

import {
  REGISTRY_CONFIGS,
  VERIFICATION_POLITENESS,
  VERIFICATION_RULE,
  isVerificationCheckId,
  parseRegistryConfigs,
  parseVerificationPoliteness,
  parseVerificationRule,
} from "./verification";

describe("verification rule", () => {
  it("loads the default rule successfully", () => {
    expect(VERIFICATION_RULE).toBeDefined();
    expect(VERIFICATION_RULE.checks.dns.required).toBe(true);
    expect(VERIFICATION_RULE.checks.http.required).toBe(true);
    expect(VERIFICATION_RULE.checks["domain-name-match"].required).toBe(false);
    expect(VERIFICATION_RULE.checks.registry.required).toBe(false);
    expect(VERIFICATION_RULE.stalenessDays).toBe(90);
  });

  it("rejects a rule naming an unknown check", () => {
    expect(() =>
      parseVerificationRule({
        checks: {
          dns: { required: true, sufficient: false, timeoutMs: 5_000 },
          unknown_check: { required: false, sufficient: false, timeoutMs: 0 },
        },
        stalenessDays: 90,
      }),
    ).toThrow("Unknown verification check");
  });

  it("rejects a rule with no required check", () => {
    expect(() =>
      parseVerificationRule({
        checks: {
          dns: { required: false, sufficient: false, timeoutMs: 5_000 },
          http: { required: false, sufficient: false, timeoutMs: 10_000 },
        },
        stalenessDays: 90,
      }),
    ).toThrow("At least one verification check must be required");
  });

  it("rejects a non-positive staleness window", () => {
    expect(() =>
      parseVerificationRule({
        checks: {
          dns: { required: true, sufficient: false, timeoutMs: 5_000 },
        },
        stalenessDays: 0,
      }),
    ).toThrow();
  });

  it("rejects a negative timeout", () => {
    expect(() =>
      parseVerificationRule({
        checks: {
          dns: { required: true, sufficient: false, timeoutMs: -1 },
        },
        stalenessDays: 90,
      }),
    ).toThrow();
  });

  it("allows a zero timeout for non-network checks", () => {
    const rule = parseVerificationRule({
      checks: {
        dns: { required: true, sufficient: false, timeoutMs: 5_000 },
        "domain-name-match": { required: false, sufficient: false, timeoutMs: 0 },
      },
      stalenessDays: 30,
    });
    expect(rule.checks["domain-name-match"].timeoutMs).toBe(0);
  });
});

describe("verification politeness", () => {
  it("loads the default politeness successfully", () => {
    expect(VERIFICATION_POLITENESS).toBeDefined();
    expect(VERIFICATION_POLITENESS.minRequestIntervalMs).toBe(1_000);
    expect(VERIFICATION_POLITENESS.maxRequestsPerCompany).toBe(10);
    expect(VERIFICATION_POLITENESS.batchConcurrency).toBe(4);
  });

  it("rejects a non-positive request interval", () => {
    expect(() =>
      parseVerificationPoliteness({
        minRequestIntervalMs: 0,
        maxRequestsPerCompany: 10,
        batchConcurrency: 4,
      }),
    ).toThrow();
  });

  it("rejects a non-positive max requests", () => {
    expect(() =>
      parseVerificationPoliteness({
        minRequestIntervalMs: 1_000,
        maxRequestsPerCompany: 0,
        batchConcurrency: 4,
      }),
    ).toThrow();
  });

  it("rejects a non-positive concurrency", () => {
    expect(() =>
      parseVerificationPoliteness({
        minRequestIntervalMs: 1_000,
        maxRequestsPerCompany: 10,
        batchConcurrency: 0,
      }),
    ).toThrow();
  });
});

describe("check identifiers", () => {
  it("recognizes implemented checks", () => {
    expect(isVerificationCheckId("dns")).toBe(true);
    expect(isVerificationCheckId("http")).toBe(true);
    expect(isVerificationCheckId("domain-name-match")).toBe(true);
    expect(isVerificationCheckId("registry")).toBe(true);
  });

  it("rejects unknown checks", () => {
    expect(isVerificationCheckId("unknown")).toBe(false);
    expect(isVerificationCheckId("ssl")).toBe(false);
  });
});

describe("registry configuration", () => {
  it("loads the default registry configuration (empty)", () => {
    expect(REGISTRY_CONFIGS).toBeDefined();
    expect(REGISTRY_CONFIGS).toHaveLength(0);
  });

  it("validates registry configurations", () => {
    const configs = parseRegistryConfigs([
      {
        countryId: "uae",
        baseUrl: "https://registry.example.com",
        searchPath: "/search?q={query}",
      },
    ]);
    expect(configs).toHaveLength(1);
    expect(configs[0]?.countryId).toBe("uae");
  });

  it("rejects duplicate country IDs", () => {
    expect(() =>
      parseRegistryConfigs([
        {
          countryId: "uae",
          baseUrl: "https://registry1.example.com",
          searchPath: "/search?q={query}",
        },
        {
          countryId: "uae",
          baseUrl: "https://registry2.example.com",
          searchPath: "/search?q={query}",
        },
      ]),
    ).toThrow("Duplicate");
  });

  it("rejects invalid URLs", () => {
    expect(() =>
      parseRegistryConfigs([
        {
          countryId: "uae",
          baseUrl: "not-a-url",
          searchPath: "/search?q={query}",
        },
      ]),
    ).toThrow();
  });
});

describe("configuration is frozen", () => {
  it("makes the rule immutable", () => {
    expect(Object.isFrozen(VERIFICATION_RULE)).toBe(true);
  });

  it("makes the politeness immutable", () => {
    expect(Object.isFrozen(VERIFICATION_POLITENESS)).toBe(true);
  });

  it("makes registry configs immutable", () => {
    expect(Object.isFrozen(REGISTRY_CONFIGS)).toBe(true);
  });
});
