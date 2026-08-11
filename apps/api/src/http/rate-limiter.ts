/**
 * The per-source request limiter (design D4).
 *
 * A token bucket per source, refilling at the effective interval — the slower
 * of the configured request rate and the crawl-delay the source itself
 * declares. A source that declares no crawl-delay is limited by what the
 * operator configured; a source that declares one is never asked faster than
 * it asks.
 */

/**
 * The effective gap between requests to one source, in milliseconds: the
 * slower of the configured rate and the declared crawl-delay. A rate of 30
 * per minute is a 2000 ms gap; a crawl-delay of 5 seconds wins over it.
 */
export function effectiveRequestIntervalMs(
  maxRequestRatePerMinute: number,
  crawlDelaySeconds: number | null,
): number {
  const configuredMs = 60_000 / maxRequestRatePerMinute;
  const declaredMs = crawlDelaySeconds === null ? 0 : crawlDelaySeconds * 1000;
  return Math.max(configuredMs, declaredMs);
}

/**
 * A token bucket with burst capacity. `acquire()` returns immediately while a
 * token is available and sleeps until the next refill when one is not, so a
 * source may burst up to its capacity but never exceed its average rate.
 *
 * The clock is injectable for tests; the default is `Date.now`.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillIntervalMs: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.lastRefillAt = now();
  }

  private refill(): void {
    const elapsed = this.now() - this.lastRefillAt;

    if (elapsed > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsed / this.refillIntervalMs);
      this.lastRefillAt = this.now();
    }
  }

  async acquire(): Promise<void> {
    for (;;) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      await sleep(Math.ceil(this.refillIntervalMs));
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
