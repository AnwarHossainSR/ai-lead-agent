import { describe, expect, it } from "vitest";

import {
  OBSERVABILITY_CONFIG,
  observabilityConfigSchema,
  registerSecretForRedaction,
} from "./observability";

describe("observability config", () => {
  it("is frozen", () => {
    expect(Object.isFrozen(OBSERVABILITY_CONFIG)).toBe(true);
  });

  it("has redaction patterns for connection strings, emails and credential keys", () => {
    const { patterns } = OBSERVABILITY_CONFIG.redaction;
    expect(patterns.connectionStrings).toBeInstanceOf(RegExp);
    expect(patterns.emails).toBeInstanceOf(RegExp);
    expect(patterns.credentialKeys).toBeInstanceOf(RegExp);
  });

  it("has a positive max string length", () => {
    expect(OBSERVABILITY_CONFIG.redaction.maxLength).toBeGreaterThan(0);
  });

  it("has metrics enabled by default", () => {
    expect(OBSERVABILITY_CONFIG.metricsEnabled).toBe(true);
  });

  it("has non-empty label sets", () => {
    const { labels } = OBSERVABILITY_CONFIG;
    expect(labels.stages.length).toBeGreaterThan(0);
    expect(labels.outcomes.length).toBeGreaterThan(0);
    expect(labels.sources.length).toBeGreaterThan(0);
    expect(labels.prompts.length).toBeGreaterThan(0);
    expect(labels.models.length).toBeGreaterThan(0);
    expect(labels.queues.length).toBeGreaterThan(0);
    expect(labels.methods.length).toBeGreaterThan(0);
    expect(labels.statusRanges.length).toBeGreaterThan(0);
    expect(labels.poolStates.length).toBeGreaterThan(0);
  });

  it("includes all pipeline stages", () => {
    const { stages } = OBSERVABILITY_CONFIG.labels;
    expect(stages).toContain("discovery");
    expect(stages).toContain("verification");
    expect(stages).toContain("scoring");
    expect(stages).toContain("research-summary");
  });

  it("includes standard HTTP methods", () => {
    const { methods } = OBSERVABILITY_CONFIG.labels;
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
  });

  it("includes database pool states", () => {
    const { poolStates } = OBSERVABILITY_CONFIG.labels;
    expect(poolStates).toContain("idle");
    expect(poolStates).toContain("active");
  });
});

describe("registerSecretForRedaction", () => {
  it("adds a secret value to the redaction list", () => {
    const secret = "test-api-key-12345";
    const updated = registerSecretForRedaction(OBSERVABILITY_CONFIG, secret);
    expect(updated.redaction.secretValues).toContain(secret);
  });

  it("does not duplicate a secret value", () => {
    const secret = "test-api-key-12345";
    const first = registerSecretForRedaction(OBSERVABILITY_CONFIG, secret);
    const second = registerSecretForRedaction(first, secret);
    expect(second.redaction.secretValues.filter((s) => s === secret)).toHaveLength(1);
  });

  it("ignores empty strings", () => {
    const updated = registerSecretForRedaction(OBSERVABILITY_CONFIG, "");
    expect(updated.redaction.secretValues).toEqual(OBSERVABILITY_CONFIG.redaction.secretValues);
  });

  it("returns a frozen config", () => {
    const updated = registerSecretForRedaction(OBSERVABILITY_CONFIG, "new-secret");
    expect(Object.isFrozen(updated)).toBe(true);
  });
});

describe("observability config schema", () => {
  it("rejects empty label sets", () => {
    expect(() =>
      observabilityConfigSchema.parse({
        redaction: OBSERVABILITY_CONFIG.redaction,
        labels: { ...OBSERVABILITY_CONFIG.labels, stages: [] },
        metricsEnabled: true,
      }),
    ).toThrow();
  });
});
