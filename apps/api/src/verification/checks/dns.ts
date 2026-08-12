import type { CheckInput, CheckResult, VerificationCheck } from "../types";

/**
 * A resolver that looks up DNS records.
 * Injected so tests are deterministic and never touch the network.
 */
export interface Resolver {
  resolve4(domain: string): Promise<string[]>;
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>;
}

/**
 * The dns check verifies that the claimed domain resolves to at least one
 * address.  Evidence includes the resolved records and the resolver used.
 *
 * Returns unknown when the resolver itself fails, rather than treating a
 * resolution failure as "the company does not exist".
 */
export function createDnsCheck(resolver: Resolver): VerificationCheck {
  return {
    id: "dns",

    async run(input: CheckInput): Promise<CheckResult> {
      const { domain, timeoutMs } = input;
      const evidenceUrl = `dns:${domain}`;

      try {
        const result = await withTimeout(
          Promise.all([resolver.resolve4(domain), resolver.resolveMx(domain)]),
          timeoutMs,
        );

        const [addresses, mxRecords] = result;

        if (addresses.length === 0 && mxRecords.length === 0) {
          return {
            checkId: "dns",
            verdict: "failed",
            evidence: `Domain ${domain} has no A, AAAA, or MX records`,
            evidenceUrl,
          };
        }

        const parts: string[] = [];
        if (addresses.length > 0) {
          parts.push(`A/AAAA: ${addresses.join(", ")}`);
        }
        if (mxRecords.length > 0) {
          parts.push(`MX: ${mxRecords.map((mx) => mx.exchange).join(", ")}`);
        }

        return {
          checkId: "dns",
          verdict: "passed",
          evidence: `Domain ${domain} resolves: ${parts.join("; ")}`,
          evidenceUrl,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Distinguish between "domain doesn't exist" and "resolver failed"
        if (isTimeoutError(error)) {
          return {
            checkId: "dns",
            verdict: "unknown",
            evidence: "",
            evidenceUrl,
            failureCode: "timeout",
          };
        }

        if (isENOTFOUND(error)) {
          return {
            checkId: "dns",
            verdict: "failed",
            evidence: `Domain ${domain} does not exist (NXDOMAIN): ${message}`,
            evidenceUrl,
          };
        }

        // Resolver itself failed — don't treat as "company absent"
        return {
          checkId: "dns",
          verdict: "unknown",
          evidence: "",
          evidenceUrl,
          failureCode: "resolver_error",
        };
      }
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === "timeout";
}

function isENOTFOUND(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as { code: string }).code === "ENOTFOUND"
  );
}
