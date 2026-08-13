import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithTimeout } from "./fetch-with-timeout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithTimeout", () => {
  it("returns ok with the parsed body on a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ count: 3 }) }),
    );

    const result = await fetchWithTimeout<{ count: number }>("https://example.com/leads");

    expect(result).toEqual({ status: "ok", data: { count: 3 } });
  });

  it("returns degraded for a non-2xx response, without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );

    const result = await fetchWithTimeout("https://example.com/leads");

    expect(result.status).toBe("degraded");
  });

  it("returns unreachable when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

    const result = await fetchWithTimeout("https://example.com/leads");

    expect(result.status).toBe("unreachable");
    if (result.status === "unreachable") {
      expect(result.error).toContain("ECONNREFUSED");
    }
  });

  it("returns unreachable, naming the timeout, when the request does not settle in time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("This operation was aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );

    const result = await fetchWithTimeout("https://example.com/leads", { timeoutMs: 10 });

    expect(result.status).toBe("unreachable");
    if (result.status === "unreachable") {
      expect(result.error).toContain("did not respond within 10ms");
    }
  });
});
