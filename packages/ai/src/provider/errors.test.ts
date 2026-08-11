import { describe, expect, it } from "vitest";

import { AIProviderError, AIProviderTimeoutError, isRetryable } from "./errors";

/** One row per D8 classification table entry. */
describe("D8 classification table", () => {
  it("a rate limit is retryable", () => {
    expect(isRetryable("rate_limited")).toBe(true);
  });

  it("a transient failure (5xx, connection reset, timeout) is retryable", () => {
    expect(isRetryable("transient")).toBe(true);
  });

  it("an authentication failure is not retryable", () => {
    expect(isRetryable("authentication_failed")).toBe(false);
  });

  it("an invalid request is not retryable", () => {
    expect(isRetryable("invalid_request")).toBe(false);
  });

  it("a content refusal is not retryable", () => {
    expect(isRetryable("content_refused")).toBe(false);
  });
});

describe("AIProviderError", () => {
  it("derives retryable from the condition", () => {
    expect(new AIProviderError("rate_limited", "rate limited").retryable).toBe(true);
    expect(new AIProviderError("authentication_failed", "bad key").retryable).toBe(false);
  });

  it("carries a retry-after hint when the vendor supplies one", () => {
    const error = new AIProviderError("rate_limited", "rate limited", 2_000);
    expect(error.retryAfterMs).toBe(2_000);
  });

  it("defaults retryAfterMs to null when the vendor supplies none", () => {
    const error = new AIProviderError("transient", "connection reset");
    expect(error.retryAfterMs).toBeNull();
  });

  it("is named for instanceof narrowing", () => {
    expect(new AIProviderError("invalid_request", "bad request").name).toBe("AIProviderError");
  });
});

describe("AIProviderTimeoutError", () => {
  it("names the configured bound", () => {
    const error = new AIProviderTimeoutError(60_000);
    expect(error.timeoutMs).toBe(60_000);
    expect(error.message).toContain("60000");
  });
});
