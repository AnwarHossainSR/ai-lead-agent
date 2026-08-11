import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AIProviderError, AIProviderTimeoutError } from "../provider/errors";
import type { AIProviderRequest } from "../provider/provider";
import { FakeAIProvider } from "./fake-provider";

function request(overrides: Partial<AIProviderRequest> = {}): AIProviderRequest {
  return {
    messages: [{ role: "user", content: "test" }],
    tool: { name: "classify", description: "Classify.", inputSchema: { type: "object" } },
    model: "test-model",
    maxOutputTokens: 100,
    timeoutMs: 1_000,
    ...overrides,
  };
}

describe("a valid scenario", () => {
  it("returns the scripted content and usage", async () => {
    const provider = new FakeAIProvider().enqueue({
      kind: "valid",
      content: { industry: "logistics" },
      usage: { inputTokens: 20 },
    });

    const response = await provider.request(request());
    expect(response.content).toEqual({ industry: "logistics" });
    expect(response.usage).toEqual({ inputTokens: 20, outputTokens: 5 });
  });
});

describe("scenarios are consumed in order", () => {
  it("advances the queue on every call", async () => {
    const provider = new FakeAIProvider().enqueue(
      { kind: "invalid_output", content: { wrong: "shape" } },
      { kind: "valid", content: { industry: "logistics" } },
    );

    const first = await provider.request(request());
    expect(first.content).toEqual({ wrong: "shape" });

    const second = await provider.request(request());
    expect(second.content).toEqual({ industry: "logistics" });

    expect(provider.calls).toHaveLength(2);
  });

  it("throws when called with nothing queued", async () => {
    await expect(new FakeAIProvider().request(request())).rejects.toThrow(/no scenario queued/);
  });
});

describe("a rate_limited scenario", () => {
  it("throws a retryable AIProviderError carrying the retry-after hint", async () => {
    const provider = new FakeAIProvider().enqueue({ kind: "rate_limited", retryAfterMs: 2_000 });

    const error = await provider.request(request()).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).retryable).toBe(true);
    expect((error as AIProviderError).retryAfterMs).toBe(2_000);
  });
});

describe("an authentication_failed scenario", () => {
  it("throws a non-retryable AIProviderError", async () => {
    const provider = new FakeAIProvider().enqueue({ kind: "authentication_failed" });

    const error = await provider.request(request()).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).retryable).toBe(false);
  });
});

describe("a hang scenario", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects with a timeout bounded by the request's own timeoutMs", async () => {
    const provider = new FakeAIProvider().enqueue({ kind: "hang" });

    const promise = provider.request(request({ timeoutMs: 500 }));
    promise.catch(() => undefined);

    await vi.advanceTimersByTimeAsync(500);
    await expect(promise).rejects.toThrow(AIProviderTimeoutError);
  });
});
