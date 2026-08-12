import { detectBlock } from "../../http/block-detection";
import type { CheckInput, CheckResult, VerificationCheck } from "../types";

/**
 * An HTTP client that fetches a URL and returns the response.
 * Injected so tests use the fixture server, not the real network.
 */
export interface HttpClient {
  fetch(
    url: string,
    options?: { signal?: AbortSignal; redirect?: "follow" | "manual" },
  ): Promise<{ status: number; headers: Record<string, string>; body: string; finalUrl: string }>;
}

/**
 * The http check verifies that the website answers with a success or
 * redirect status.  It follows up to 5 redirects and records the final
 * URL as evidence.
 *
 * Returns unknown on block, timeout, or unusable response.
 */
export function createHttpCheck(client: HttpClient): VerificationCheck {
  return {
    id: "http",

    async run(input: CheckInput): Promise<CheckResult> {
      const { websiteUrl, timeoutMs } = input;

      if (!websiteUrl) {
        return {
          checkId: "http",
          verdict: "unknown",
          evidence: "",
          evidenceUrl: "",
          failureCode: "no_website",
        };
      }

      const evidenceUrl = websiteUrl;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await client.fetch(websiteUrl, {
          signal: controller.signal,
          redirect: "follow",
        });

        const blockVerdict = detectBlock(response.status, response.headers, response.body);

        if (blockVerdict.blocked) {
          return {
            checkId: "http",
            verdict: "unknown",
            evidence: "",
            evidenceUrl,
            failureCode: "blocked",
          };
        }

        if (response.status >= 200 && response.status < 400) {
          return {
            checkId: "http",
            verdict: "passed",
            evidence: `HTTP ${response.status} from ${response.finalUrl}`,
            evidenceUrl: response.finalUrl,
          };
        }

        return {
          checkId: "http",
          verdict: "failed",
          evidence: `HTTP ${response.status} from ${response.finalUrl}`,
          evidenceUrl: response.finalUrl,
        };
      } catch (error) {
        if (isAbortError(error) || isTimeoutError(error)) {
          return {
            checkId: "http",
            verdict: "unknown",
            evidence: "",
            evidenceUrl,
            failureCode: "timeout",
          };
        }

        return {
          checkId: "http",
          verdict: "unknown",
          evidence: "",
          evidenceUrl,
          failureCode: "unusable_response",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === "timeout";
}

