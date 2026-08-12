import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent, GoogleGenAIMock } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  GoogleGenAIMock: vi.fn(),
}));

class MockApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

vi.mock("@google/genai", () => ({
  // `new module.GoogleGenAI(...)` requires a real constructor — an arrow
  // function cannot be invoked with `new`, so this returns an object from an
  // ordinary function, which `new` accepts in its place.
  GoogleGenAI: GoogleGenAIMock.mockImplementation(function GoogleGenAI() {
    return { models: { generateContent } };
  }),
  ApiError: MockApiError,
  FunctionCallingConfigMode: { ANY: "ANY" },
}));

import { AIProviderError, AIProviderTimeoutError } from "./errors";
import { GeminiProvider } from "./gemini";
import type { AIProviderRequest } from "./provider";

function request(overrides: Partial<AIProviderRequest> = {}): AIProviderRequest {
  return {
    messages: [
      { role: "system" as const, content: "Classify the industry." },
      { role: "user" as const, content: "A logistics company." },
    ],
    tool: { name: "classify", description: "Classify.", inputSchema: { type: "object" } },
    model: "gemini-2.5-pro",
    maxOutputTokens: 512,
    timeoutMs: 30_000,
    ...overrides,
  };
}

function contentResponse(
  args: Record<string, unknown>,
  usage = { promptTokenCount: 10, candidatesTokenCount: 5 },
) {
  return { functionCalls: [{ name: "classify", args }], usageMetadata: usage };
}

beforeEach(() => {
  generateContent.mockReset();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function settle<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  await vi.runAllTimersAsync();
  return promise;
}

describe("a successful call", () => {
  it("returns the tool call arguments and token usage", async () => {
    generateContent.mockResolvedValue(contentResponse({ industry: "logistics" }));

    const provider = new GeminiProvider("test-gemini-key");
    const response = await settle(provider.request(request()));

    expect(response.content).toEqual({ industry: "logistics" });
    expect(response.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
  });

  it("forces the model to call the declared tool", async () => {
    generateContent.mockResolvedValue(contentResponse({ industry: "logistics" }));

    await settle(new GeminiProvider("k").request(request()));

    const call = generateContent.mock.calls[0]?.[0];
    expect(call.config.toolConfig.functionCallingConfig.mode).toBe("ANY");
    expect(call.config.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual(["classify"]);
  });
});

describe("a rate limit", () => {
  it("is retried and eventually succeeds", async () => {
    generateContent
      .mockRejectedValueOnce(new MockApiError(429, "rate limited"))
      .mockResolvedValueOnce(contentResponse({ industry: "logistics" }));

    const response = await settle(new GeminiProvider("k").request(request()));

    expect(response.content).toEqual({ industry: "logistics" });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});

describe("an authentication failure", () => {
  it("is not retried", async () => {
    generateContent.mockRejectedValue(new MockApiError(401, "invalid key"));

    await expect(settle(new GeminiProvider("k").request(request()))).rejects.toThrow(
      AIProviderError,
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("an invalid request", () => {
  it("is not retried", async () => {
    generateContent.mockRejectedValue(new MockApiError(400, "malformed schema"));

    const error = await settle(new GeminiProvider("k").request(request())).catch(
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).condition).toBe("invalid_request");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("a connection failure below the SDK", () => {
  it("is classified as transient and retried", async () => {
    generateContent
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(contentResponse({ industry: "logistics" }));

    const response = await settle(new GeminiProvider("k").request(request()));

    expect(response.content).toEqual({ industry: "logistics" });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});

describe("a hanging call", () => {
  it("is bounded by the timeout and retried as transient", async () => {
    // Mirrors what the real SDK does: it never settles on its own, but
    // rejects once the AbortSignal passed to it fires.
    generateContent.mockImplementation(
      (params: { config: { abortSignal: AbortSignal } }) =>
        new Promise((_resolve, reject) => {
          params.config.abortSignal.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const promise = settle(new GeminiProvider("k").request(request({ timeoutMs: 1_000 })));

    await expect(promise).rejects.toThrow(AIProviderTimeoutError);
    // Three transport attempts, each bounded by its own 1s timeout.
    expect(generateContent).toHaveBeenCalledTimes(3);
  });
});

describe("a response with no function call", () => {
  it("is classified as content refusal and is not retried", async () => {
    generateContent.mockResolvedValue({ functionCalls: undefined, usageMetadata: {} });

    await expect(settle(new GeminiProvider("k").request(request()))).rejects.toThrow(
      /did not return a structured result/,
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("credential safety", () => {
  it("never includes the API key in a thrown error's message", async () => {
    const key = "sekrit-should-never-appear-in-an-error";
    generateContent.mockRejectedValue(new MockApiError(500, `upstream failure near key ${key}`));

    let thrown: unknown;
    try {
      await settle(new GeminiProvider(key).request(request()));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(key);
  });
});
