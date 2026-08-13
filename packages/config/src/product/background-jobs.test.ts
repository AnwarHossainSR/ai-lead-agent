import { describe, expect, it } from "vitest";

import {
  QUEUE_CONFIGS,
  findQueueConfig,
  parseQueueConfigs,
  resolveQueueConfig,
  validateConcurrency,
} from "./background-jobs";

describe("default queue configs", () => {
  it("define all nine queues", () => {
    expect(Object.keys(QUEUE_CONFIGS)).toEqual([
      "discovery",
      "verification",
      "website-analysis",
      "technology-detection",
      "opportunity-analysis",
      "contact-research",
      "scoring",
      "research-summary",
      "reply-classification",
    ]);
  });

  it("each have positive concurrency, attempts and timeout", () => {
    for (const [name, config] of Object.entries(QUEUE_CONFIGS)) {
      expect(config.concurrency, `queue ${name} concurrency`).toBeGreaterThan(0);
      expect(config.attempts, `queue ${name} attempts`).toBeGreaterThan(0);
      expect(config.timeout, `queue ${name} timeout`).toBeGreaterThan(0);
      expect(config.backoff, `queue ${name} backoff`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("resolveQueueConfig", () => {
  it("returns the config for a known queue", () => {
    expect(resolveQueueConfig("scoring").concurrency).toBe(8);
  });

  it("throws for an unknown queue, naming the unknown and the known set", () => {
    expect(() => resolveQueueConfig("unknown")).toThrow(/Unknown queue "unknown"/);
    expect(() => resolveQueueConfig("unknown")).toThrow(/Configured queues:/);
  });
});

describe("findQueueConfig", () => {
  it("returns undefined for an unknown queue", () => {
    expect(findQueueConfig("unknown")).toBeUndefined();
  });

  it("returns the config for a known queue", () => {
    expect(findQueueConfig("discovery")).toBe(QUEUE_CONFIGS.discovery);
  });
});

describe("validateConcurrency", () => {
  it("passes when every concurrency is positive", () => {
    expect(() =>
      validateConcurrency("test", {
        a: { concurrency: 1, attempts: 1, backoff: 1000, timeout: 1000 },
      }),
    ).not.toThrow();
  });

  it("throws naming the queue when a concurrency is zero", () => {
    expect(() =>
      validateConcurrency("test", {
        bad: { concurrency: 0, attempts: 1, backoff: 1000, timeout: 1000 },
      }),
    ).toThrow(/Queue "bad" has a non-positive concurrency: 0/);
  });

  it("throws naming the queue when a concurrency is negative", () => {
    expect(() =>
      validateConcurrency("test", {
        bad: { concurrency: -1, attempts: 1, backoff: 1000, timeout: 1000 },
      }),
    ).toThrow(/Queue "bad" has a non-positive concurrency: -1/);
  });
});

describe("parseQueueConfigs", () => {
  it("parses a well-formed config map", () => {
    const configs = parseQueueConfigs({
      custom: { concurrency: 2, attempts: 1, backoff: 5000, timeout: 5000 },
    });

    expect(configs.custom!.concurrency).toBe(2);
    expect(configs.custom!.attempts).toBe(1);
    expect(configs.custom!.timeout).toBe(5000);
    expect(configs.custom!.backoff).toBe(5_000);
  });

  it("refuses an empty config map", () => {
    expect(() => parseQueueConfigs({})).toThrow(/must contain at least 1 element/);
  });

  it("refuses a non-positive concurrency", () => {
    expect(() =>
      parseQueueConfigs({
        bad: { concurrency: 0, attempts: 1, backoff: 1000, timeout: 1000 },
      }),
    ).toThrow(/Queue "bad" has a non-positive concurrency: 0/);
  });

  it("refuses a config missing a required field", () => {
    expect(() =>
      parseQueueConfigs({
        bad: { concurrency: 1 },
      }),
    ).toThrow(/bad.(attempts|timeout)/);
  });
});
