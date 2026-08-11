import { CheckTimeoutError } from "./check-timeout";

/**
 * Turns a failed dependency check into a message safe to return over an
 * unauthenticated endpoint.
 *
 * The rule this file exists to enforce: no error message from a driver ever
 * reaches the response body. `postgres` puts the host, the port and the user
 * into its errors, and a misconfigured `DATABASE_URL` can put the whole
 * connection string — password included — into a thrown `TypeError`. So the
 * text is built here from a fixed vocabulary, and the only detail carried over
 * from the original error is its error code, which is matched against a shape
 * that no credential can satisfy.
 */

/** `ECONNREFUSED`, `ENOTFOUND`, `28P01`. Nothing with a symbol in it. */
const ERROR_CODE = /^[A-Z0-9_]{3,32}$/;

/** Guards against a self-referential cause chain. */
const MAX_CAUSE_DEPTH = 5;

function extractCode(error: unknown): string | null {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return null;
    }

    const code: unknown = (current as { code?: unknown }).code;
    if (typeof code === "string" && ERROR_CODE.test(code)) {
      return code;
    }

    current = (current as { cause?: unknown }).cause;
  }

  return null;
}

export function describeFailure(dependency: string, error: unknown): string {
  if (error instanceof CheckTimeoutError) {
    return `${dependency} did not respond within ${error.timeoutMs} ms.`;
  }

  const code = extractCode(error);

  return code === null
    ? `${dependency} is unreachable.`
    : `${dependency} is unreachable (${code}).`;
}
