/**
 * Every dependency check is bounded here rather than trusting each client's
 * own timeout settings. A driver that decides to retry, or a TCP connection to
 * a host that silently drops packets, can leave a promise pending far longer
 * than any configured `connectTimeout` suggests — and a health endpoint that
 * hangs is worse than one that reports a failure, because nothing upstream can
 * tell the difference between "slow" and "dead".
 */

export const CHECK_TIMEOUT_MS = 2_000;

export class CheckTimeoutError extends Error {
  readonly dependency: string;
  readonly timeoutMs: number;

  constructor(dependency: string, timeoutMs: number) {
    super(`${dependency} did not respond within ${timeoutMs} ms.`);
    this.name = "CheckTimeoutError";
    this.dependency = dependency;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Resolves with `work`, or rejects with a `CheckTimeoutError` once
 * `timeoutMs` has passed — whichever happens first.
 *
 * A later rejection from `work` needs no separate handler: `Promise.race`
 * subscribes to it, so it is never an unhandled rejection even when the race
 * has already been decided.
 */
export async function withCheckTimeout<T>(
  dependency: string,
  work: Promise<T>,
  timeoutMs: number = CHECK_TIMEOUT_MS,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new CheckTimeoutError(dependency, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
