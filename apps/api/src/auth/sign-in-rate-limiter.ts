/**
 * Rate limiting for sign-in attempts (design D3), per account and per source
 * address, over a configured window.
 *
 * Two independent buckets rather than one: a limit keyed only by address
 * would let one attacker's failures block a legitimate user behind the same
 * NAT, and a limit keyed only by email would let an attacker spread guesses
 * across many source addresses. Both keys are hit on every attempt, known
 * account or not, so the throttled response looks the same either way — an
 * unknown email still accrues a bucket of its own.
 *
 * In-memory and per-process: there is one API process (design D2's own
 * reasoning for server-side sessions applies here too).
 */

interface Window {
  count: number;
  windowStart: number;
}

export class SignInRateLimiter {
  private readonly hits = new Map<string, Window>();

  constructor(
    private readonly windowMs: number,
    private readonly maxAttemptsPerAccount: number,
    private readonly maxAttemptsPerSource: number,
    private readonly now: () => number = Date.now,
  ) {}

  private hit(key: string, limit: number): boolean {
    const nowMs = this.now();
    const existing = this.hits.get(key);

    if (existing === undefined || nowMs - existing.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: nowMs });
      return true;
    }

    if (existing.count >= limit) {
      return false;
    }

    existing.count += 1;
    return true;
  }

  /** Registers one attempt for `email` and `sourceAddress`. Returns whether it may proceed. */
  registerAttempt(email: string, sourceAddress: string): boolean {
    const accountOk = this.hit(`account:${email.trim().toLowerCase()}`, this.maxAttemptsPerAccount);
    const sourceOk = this.hit(`source:${sourceAddress}`, this.maxAttemptsPerSource);

    return accountOk && sourceOk;
  }

  /** Clears an account's bucket on a successful sign-in, so a real user is not left throttled by their own earlier typos. */
  reset(email: string): void {
    this.hits.delete(`account:${email.trim().toLowerCase()}`);
  }
}
