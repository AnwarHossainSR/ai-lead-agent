import { AIProviderError, AIProviderTimeoutError } from "./errors";

/**
 * Bounds how many times a transport attempt is retried (design D8's
 * "configured attempt limit"). Not the same number as the schema-validation
 * repair attempt in `AIService` — that is a separate, single retry over the
 * *content* of a successful response, tracked independently.
 */
const MAX_TRANSPORT_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

function backoffDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
  return exponential + Math.random() * exponential * 0.25;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retries `work` up to `MAX_TRANSPORT_ATTEMPTS`, but only on a retryable
 * `AIProviderError` or an `AIProviderTimeoutError` (design D8). Every other
 * failure — including a non-retryable `AIProviderError` — is rethrown on the
 * first attempt.
 *
 * Delay honours the vendor's own retry-after when the error carries one
 * (a 429 response); otherwise it backs off exponentially with jitter.
 */
export async function withRetry<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSPORT_ATTEMPTS; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      const retryable =
        (error instanceof AIProviderError && error.retryable) ||
        error instanceof AIProviderTimeoutError;
      const isLastAttempt = attempt === MAX_TRANSPORT_ATTEMPTS;

      if (!retryable || isLastAttempt) {
        throw error;
      }

      const retryAfterMs = error instanceof AIProviderError ? error.retryAfterMs : null;
      await sleep(retryAfterMs ?? backoffDelay(attempt));
    }
  }

  // Unreachable — the loop above always returns or throws.
  throw new Error("withRetry exhausted its attempts without returning or throwing.");
}
