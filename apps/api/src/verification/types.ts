/**
 * The verification check interface.
 *
 * Every check implements `run()` and returns a `CheckResult` with a verdict
 * of `passed`, `failed`, or `unknown`.  A passed or failed verdict MUST
 * carry evidence; without evidence the guard downgrades it to unknown.
 *
 * Checks are stateless — the same input always produces the same output.
 * No check may call a language model.
 */

/**
 * A single check result carrying its verdict and evidence.
 */
export interface CheckResult {
  /** The check that produced this result. */
  readonly checkId: string;
  /** The verdict: passed, failed, or unknown. */
  readonly verdict: "passed" | "failed" | "unknown";
  /** Human-readable description of what was observed. */
  readonly evidence: string;
  /** URL or identifier where the evidence can be inspected. */
  readonly evidenceUrl: string;
  /**
   * Why the check returned unknown.  Only set when verdict is `unknown`.
   * Examples: "timeout", "blocked", "unusable_response", "resolver_error".
   */
  readonly failureCode?: string;
}

/**
 * Input passed to every check's `run()` method.
 */
export interface CheckInput {
  /** The company identifier. */
  readonly companyId: string;
  /** The domain to check (normalized). */
  readonly domain: string;
  /** The full website URL, if available. */
  readonly websiteUrl?: string;
  /** The company name (normalized). */
  readonly companyName: string;
  /** Timeout in milliseconds for this check. */
  readonly timeoutMs: number;
}

/**
 * A verification check that can be run against a company.
 */
export interface VerificationCheck {
  /** Unique identifier matching the rule's check key (e.g. "dns", "http"). */
  readonly id: string;
  /** Run the check and return a result. */
  run(input: CheckInput): Promise<CheckResult>;
}
