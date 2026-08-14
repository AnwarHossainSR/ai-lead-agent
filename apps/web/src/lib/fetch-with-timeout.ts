const DEFAULT_TIMEOUT_MS = 2000;

export type FetchResult<T> =
  | { status: "ok"; data: T }
  | { status: "degraded"; error: string }
  | { status: "unreachable"; error: string };

/**
 * Fetches JSON with a bounded timeout, never throwing. Every panel that
 * reads from the API uses this (design D6/D7), so a slow or unreachable
 * dependency degrades the one panel that depends on it rather than hanging
 * the page or taking the rest of it down.
 *
 * "degraded" is a reachable server that returned a non-2xx response;
 * "unreachable" is no response at all — connection refused, DNS failure,
 * or the timeout firing. The distinction is preserved because the two
 * situations mean different things to an operator debugging the page.
 */
export async function fetchWithTimeout<T>(
  url: string,
  options: { timeoutMs?: number; init?: RequestInit } = {},
): Promise<FetchResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, init } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Every panel using this reads live operational state — a cached
    // response would mean "the API was down" or "42 companies" gets baked
    // into the page at build time and never changes again in production.
    // Next's fetch cache is opt-out per call, not per app, so this is set
    // explicitly rather than relying on a global default.
    const response = await fetch(url, { cache: "no-store", ...init, signal: controller.signal });

    if (!response.ok) {
      return { status: "degraded", error: `${url} responded with ${response.status}.` };
    }

    const data = (await response.json()) as T;
    return { status: "ok", data };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "unreachable", error: `${url} did not respond within ${timeoutMs}ms.` };
    }

    return {
      status: "unreachable",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
