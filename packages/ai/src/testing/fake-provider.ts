import { AIProviderError, AIProviderTimeoutError } from "../provider/errors";
import type { AIProvider, AIProviderRequest, AIProviderResponse } from "../provider/provider";

/**
 * One scripted outcome for `FakeAIProvider.request` to produce next (design
 * D9). `valid` and `invalid_output` are mechanically identical at this
 * layer — both are a successful transport response — but named separately so
 * a test enqueueing one documents *why* the content is wrong, since
 * `AIService`'s Zod parse is what actually tells them apart.
 */
export type FakeProviderScenario =
  | { readonly kind: "valid"; readonly content: unknown; readonly usage?: Partial<AIProviderResponse["usage"]> }
  | { readonly kind: "invalid_output"; readonly content: unknown }
  | { readonly kind: "rate_limited"; readonly retryAfterMs?: number }
  | { readonly kind: "authentication_failed" }
  | { readonly kind: "hang" };

/**
 * A programmable `AIProvider` for tests. Enqueued scenarios represent what a
 * real provider would surface *after* its own transport-level retry has run
 * its course (design D8/D9 already cover that machinery against gemini.ts
 * and cloudflare.ts) — this fake never retries and never calls a vendor.
 *
 * It is the only way to deterministically test "returns invalid output
 * twice, then fails" or "the ceiling was reached before a call was made".
 */
export class FakeAIProvider implements AIProvider {
  private readonly queue: FakeProviderScenario[] = [];
  readonly calls: AIProviderRequest[] = [];

  enqueue(...scenarios: readonly FakeProviderScenario[]): this {
    this.queue.push(...scenarios);
    return this;
  }

  async request(request: AIProviderRequest): Promise<AIProviderResponse> {
    this.calls.push(request);

    const scenario = this.queue.shift();
    if (scenario === undefined) {
      throw new Error("FakeAIProvider.request was called with no scenario queued.");
    }

    switch (scenario.kind) {
      case "valid":
        return { content: scenario.content, usage: { inputTokens: 10, outputTokens: 5, ...scenario.usage } };
      case "invalid_output":
        return { content: scenario.content, usage: { inputTokens: 10, outputTokens: 5 } };
      case "rate_limited":
        throw new AIProviderError("rate_limited", "fake rate limit", scenario.retryAfterMs ?? null);
      case "authentication_failed":
        throw new AIProviderError("authentication_failed", "fake authentication failure");
      case "hang":
        // Mirrors what a real provider does: never settles on its own, but
        // is bounded by the request's own timeout — usable with fake timers.
        return new Promise<AIProviderResponse>((_resolve, reject) => {
          setTimeout(() => reject(new AIProviderTimeoutError(request.timeoutMs)), request.timeoutMs);
        });
    }
  }
}
