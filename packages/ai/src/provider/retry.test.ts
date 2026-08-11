import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AIProviderError, AIProviderTimeoutError } from "./errors";
import { withRetry } from "./retry";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Runs `promise` while draining every pending timer, so backoff sleeps
 * resolve immediately. The no-op `.catch` marks `promise` as handled
 * synchronously — before any timer callback can reject it — so a test
 * expecting rejection does not also trip Vitest's unhandled-rejection
 * detector on the same promise.
 */
async function settle<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  await vi.runAllTimersAsync();
  return promise;
}

describe("a call that succeeds on the first attempt", () => {
  it("returns without retrying", async () => {
    const work = vi.fn().mockResolvedValue("ok");
    await expect(settle(withRetry(work))).resolves.toBe("ok");
    expect(work).toHaveBeenCalledTimes(1);
  });
});

describe("a retryable failure", () => {
  it("is retried and returns the eventual success", async () => {
    const work = vi
      .fn()
      .mockRejectedValueOnce(new AIProviderError("rate_limited", "rate limited"))
      .mockResolvedValueOnce("ok");

    await expect(settle(withRetry(work))).resolves.toBe("ok");
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("honours a retry-after hint instead of exponential backoff", async () => {
    const work = vi
      .fn()
      .mockRejectedValueOnce(new AIProviderError("rate_limited", "rate limited", 5_000))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(work);
    await vi.advanceTimersByTimeAsync(4_999);
    expect(work).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe("ok");
  });

  it("retries a timeout the same as a transient failure", async () => {
    const work = vi
      .fn()
      .mockRejectedValueOnce(new AIProviderTimeoutError(60_000))
      .mockResolvedValueOnce("ok");

    await expect(settle(withRetry(work))).resolves.toBe("ok");
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured attempt limit", async () => {
    const work = vi.fn().mockRejectedValue(new AIProviderError("transient", "connection reset"));

    await expect(settle(withRetry(work))).rejects.toThrow(AIProviderError);
    expect(work).toHaveBeenCalledTimes(3);
  });
});

describe("a non-retryable failure", () => {
  it("is thrown on the first attempt, without retrying", async () => {
    const work = vi.fn().mockRejectedValue(new AIProviderError("authentication_failed", "bad key"));

    await expect(settle(withRetry(work))).rejects.toThrow(/bad key/);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("is not retried when it is not an AIProviderError at all", async () => {
    const work = vi.fn().mockRejectedValue(new Error("something unrelated"));

    await expect(settle(withRetry(work))).rejects.toThrow("something unrelated");
    expect(work).toHaveBeenCalledTimes(1);
  });
});
