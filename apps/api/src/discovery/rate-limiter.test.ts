import { describe, expect, it, vi } from "vitest";

import { effectiveRequestIntervalMs, TokenBucket } from "./rate-limiter";

describe("effectiveRequestIntervalMs", () => {
  it("derives the interval from the configured rate alone when no crawl delay is declared", () => {
    expect(effectiveRequestIntervalMs(60, null)).toBe(1000);
    expect(effectiveRequestIntervalMs(30, null)).toBe(2000);
    expect(effectiveRequestIntervalMs(120, null)).toBe(500);
  });

  it("takes the slower of the configured interval and the declared crawl delay", () => {
    expect(effectiveRequestIntervalMs(60, 5)).toBe(5000);
  });

  it("prefers the configured interval when it is the slower of the two", () => {
    expect(effectiveRequestIntervalMs(6, 5)).toBe(10000);
  });

  it("treats a crawl delay shorter than the configured interval as irrelevant", () => {
    expect(effectiveRequestIntervalMs(60, 0.5)).toBe(1000);
  });
});

describe("TokenBucket", () => {
  it("lets a burst through up to its capacity without waiting", async () => {
    const started = Date.now();
    const bucket = new TokenBucket(3, 60_000);

    await bucket.acquire();
    await bucket.acquire();
    await bucket.acquire();

    expect(Date.now() - started).toBeLessThan(100);
  });

  it("waits out a full refill interval once the bucket is empty", async () => {
    const started = Date.now();
    const bucket = new TokenBucket(1, 50);

    await bucket.acquire();
    await bucket.acquire();

    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });

  it("refills with the elapsed time, not by call count", async () => {
    let now = 0;
    const bucket = new TokenBucket(2, 1000, () => now);

    await bucket.acquire();
    await bucket.acquire();

    // The clock jumps one and a half intervals: one full token and half a
    // token accrue, so a third acquire succeeds without sleeping.
    now = 1500;
    await bucket.acquire();

    expect(now).toBe(1500);
  });

  it("uses the injected clock for refill calculations", async () => {
    const now = vi.fn(() => 0);
    const bucket = new TokenBucket(1, 1000, now);

    await bucket.acquire();

    now.mockReturnValue(1000);
    await bucket.acquire();

    expect(now).toHaveBeenCalled();
  });
});
