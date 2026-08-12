/**
 * Block detection (design D4).
 *
 * A 403, a 429 that does not say when to try again, or a response that reads
 * like a bot check ends a source for the run and records it as `blocked`.
 * There is deliberately no code path here — or anywhere in this module — that
 * disguises a request, rotates an identity, or solves a challenge. The absence
 * is the control, and a test asserts the module exposes none of it.
 */

export type BlockVerdict =
  | { readonly blocked: false }
  | { readonly blocked: true; readonly reason: string };

/** Response bodies that mean "we know you are automated", however phrased. */
const CHALLENGE_SIGNATURES = [
  "captcha",
  "cf-chl",
  "unusual traffic",
  "attention required",
  "verify you are human",
  "robot check",
  "access denied",
  "not a robot",
] as const;

export function detectBlock(
  status: number,
  headers: Readonly<Record<string, string>>,
  body: string,
): BlockVerdict {
  if (status === 403) {
    return { blocked: true, reason: "http_403" };
  }

  // A 429 with `retry-after` is a rate limit that can be waited out; one
  // without it is indistinguishable from a refusal, so it is treated as a
  // block rather than a reason to keep asking.
  if (status === 429 && headers["retry-after"] === undefined) {
    return { blocked: true, reason: "http_429_without_retry_after" };
  }

  const lower = body.toLowerCase();

  for (const signature of CHALLENGE_SIGNATURES) {
    if (lower.includes(signature)) {
      return { blocked: true, reason: "bot_challenge" };
    }
  }

  return { blocked: false };
}
