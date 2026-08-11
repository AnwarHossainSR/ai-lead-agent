/**
 * Canonical failure conditions a provider implementation classifies its own
 * vendor's errors into (design D8). Two vendors, one classification table:
 * `gemini.ts` and `cloudflare.ts` each map their own HTTP status codes and
 * error shapes onto these conditions rather than exposing vendor-specific
 * detail to `AIService` or to retry logic above them.
 *
 * Schema validation failure is deliberately absent — it is not a transport
 * condition. `AIService` handles it directly with its own one-repair-attempt
 * rule (design D4), tracked separately from these transport retries.
 */
export type AIProviderConditionType =
  | "rate_limited"
  | "transient"
  | "authentication_failed"
  | "invalid_request"
  | "content_refused";

const RETRYABLE: ReadonlySet<AIProviderConditionType> = new Set(["rate_limited", "transient"]);

/** True for `rate_limited` and `transient` — every other condition is terminal (design D8). */
export function isRetryable(condition: AIProviderConditionType): boolean {
  return RETRYABLE.has(condition);
}

/**
 * Raised by an `AIProvider` implementation. Carries the classified condition
 * rather than the vendor's raw error, so retry logic never has to know which
 * vendor it is talking to.
 *
 * `retryAfterMs` is honoured when the vendor supplies one on a rate limit
 * response; otherwise the caller's own exponential backoff applies.
 */
export class AIProviderError extends Error {
  readonly condition: AIProviderConditionType;
  readonly retryable: boolean;
  readonly retryAfterMs: number | null;

  constructor(
    condition: AIProviderConditionType,
    message: string,
    retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "AIProviderError";
    this.condition = condition;
    this.retryable = isRetryable(condition);
    this.retryAfterMs = retryAfterMs;
  }
}

/** Raised when a call does not complete within the configured timeout (design D8). */
export class AIProviderTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`The model call did not respond within ${timeoutMs}ms.`);
    this.name = "AIProviderTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}
