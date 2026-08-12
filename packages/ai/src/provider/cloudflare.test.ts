import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudflareProvider } from "./cloudflare";
import { AIProviderError, AIProviderTimeoutError } from "./errors";
import type { AIProviderRequest } from "./provider";

const fetchMock = vi.fn();

function request(overrides: Partial<AIProviderRequest> = {}): AIProviderRequest {
  return {
    messages: [
      { role: "system", content: "Classify the industry." },
      { role: "user", content: "A logistics company." },
    ],
    tool: { name: "classify", description: "Classify.", inputSchema: { type: "object" } },
    model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    maxOutputTokens: 512,
    timeoutMs: 30_000,
    ...overrides,
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function provider(): CloudflareProvider {
  return new CloudflareProvider({ accountId: "acct-1", apiToken: "test-cf-token" });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function settle<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  await vi.runAllTimersAsync();
  return promise;
}

describe("a successful call", () => {
  it("returns the tool call arguments and token usage", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        result: {
          tool_calls: [{ name: "classify", arguments: { industry: "logistics" } }],
          usage: { prompt_tokens: 20, completion_tokens: 8 },
        },
      }),
    );

    const response = await settle(provider().request(request()));

    expect(response.content).toEqual({ industry: "logistics" });
    expect(response.usage).toEqual({ inputTokens: 20, outputTokens: 8 });
  });

  it("calls the account-scoped URL with a bearer token and the tool definition", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        result: { tool_calls: [{ name: "classify", arguments: {} }] },
      }),
    );

    await settle(provider().request(request()));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct-1/ai/run/@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-cf-token");

    const body = JSON.parse(init.body as string) as { tools: unknown[] };
    expect(body.tools).toEqual([
      {
        type: "function",
        function: { name: "classify", description: "Classify.", parameters: { type: "object" } },
      },
    ]);
  });
});

describe("a rate limit", () => {
  it("honours the Retry-After header instead of exponential backoff", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { success: false }, { "retry-after": "3" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          result: { tool_calls: [{ name: "classify", arguments: {} }] },
        }),
      );

    const promise = provider().request(request());
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBeDefined();
  });
});

describe("an authentication failure", () => {
  it("is not retried", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { success: false }));

    await expect(settle(provider().request(request()))).rejects.toThrow(AIProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("an invalid request", () => {
  it("is not retried", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { success: false }));

    const error = await settle(provider().request(request())).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).condition).toBe("invalid_request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("a connection failure below the HTTP layer", () => {
  it("is classified as transient and retried", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        result: { tool_calls: [{ name: "classify", arguments: {} }] },
      }),
    );

    const response = await settle(provider().request(request()));

    expect(response.content).toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("a server error", () => {
  it("is retried as transient", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { success: false })).mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        result: { tool_calls: [{ name: "classify", arguments: {} }] },
      }),
    );

    const response = await settle(provider().request(request()));
    expect(response.content).toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("a hanging call", () => {
  it("is bounded by the timeout and retried as transient", async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const promise = settle(provider().request(request({ timeoutMs: 1_000 })));

    await expect(promise).rejects.toThrow(AIProviderTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("a response with no tool call", () => {
  it("is classified as content refusal and is not retried", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, result: { tool_calls: [] } }));

    await expect(settle(provider().request(request()))).rejects.toThrow(
      /did not return a structured result/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("credential safety", () => {
  it("never includes the API token in a thrown error's message", async () => {
    const token = "sekrit-should-never-appear-in-an-error";
    fetchMock.mockResolvedValue(jsonResponse(500, { success: false }));

    let thrown: unknown;
    try {
      await settle(
        new CloudflareProvider({ accountId: "acct-1", apiToken: token }).request(request()),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).not.toContain(token);
  });
});
