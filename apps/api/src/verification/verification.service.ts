import * as dns from "node:dns";
import * as http from "node:http";
import * as https from "node:https";
import { REGISTRY_CONFIGS, VERIFICATION_RULE } from "@mela/config";
import { companies } from "@mela/database";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { type Database } from "@mela/database";
import { DATABASE } from "../database/database.module";
import {
  createDnsCheck,
  createDomainNameMatchCheck,
  createHttpCheck,
  createRegistryCheck,
} from "./checks";
import { deriveState } from "./derive-state";
import { enforceEvidenceRequirement } from "./guard";
import type { CheckResult, VerificationCheck } from "./types";

/**
 * Creates a default DNS resolver using Node.js dns module.
 */
function createDefaultResolver(): import("./checks/dns").Resolver {
  return {
    resolve4: (domain: string) =>
      new Promise<string[]>((resolve, reject) => {
        dns.resolve4(domain, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      }),
    resolveMx: (domain: string) =>
      new Promise<Array<{ exchange: string; priority: number }>>((resolve, reject) => {
        dns.resolveMx(domain, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      }),
  };
}

/**
 * Creates a default HTTP client using Node.js http/https modules.
 */
function createDefaultHttpClient(): import("./checks/http").HttpClient {
  return {
    fetch: async (
      url: string,
      options?: { signal?: AbortSignal; redirect?: "follow" | "manual" },
    ): Promise<{
      status: number;
      headers: Record<string, string>;
      body: string;
      finalUrl: string;
    }> => {
      return new Promise((resolve, reject) => {
        const mod = url.startsWith("https") ? https : http;
        const req = mod.get(url, { signal: options?.signal }, (res) => {
          let body = "";
          res.on("data", (chunk: string) => {
            body += chunk;
          });
          res.on("end", () => {
            const headers: Record<string, string> = {};
            if (res.headers) {
              for (const [key, value] of Object.entries(res.headers)) {
                if (typeof value === "string") {
                  headers[key] = value;
                }
              }
            }
            resolve({
              status: res.statusCode ?? 0,
              headers,
              body,
              finalUrl: url,
            });
          });
        });
        req.on("error", reject);
      });
    },
  };
}

/**
 * Orchestrates verification passes for one or more companies.
 *
 * Runs each configured check, persists every result, derives the state,
 * and writes it with its derivation time.
 */
@Injectable()
export class VerificationService {
  private readonly checks: readonly VerificationCheck[];

  constructor(@Inject(DATABASE) private readonly database: Database) {
    this.checks = [
      createDnsCheck(createDefaultResolver()),
      createHttpCheck(createDefaultHttpClient()),
      createDomainNameMatchCheck(),
      createRegistryCheck(REGISTRY_CONFIGS, {
        fetch: async (url: string) => {
          const response = await globalThis.fetch(url);
          return {
            status: response.status,
            body: await response.text(),
          };
        },
      }),
    ];
  }

  /**
   * Verifies a single company by running all configured checks.
   */
  async verifyCompany(input: {
    companyId: string;
    websiteUrl?: string;
    companyName: string;
    domain: string;
    countryId?: string;
  }): Promise<{ state: string; checkResults: CheckResult[] }> {
    const checkResults: CheckResult[] = [];

    for (const check of this.checks) {
      const timeoutMs = VERIFICATION_RULE.checks[check.id]?.timeoutMs ?? 5_000;

      const rawResult = await check.run(
        {
          companyId: input.companyId,
          domain: input.domain,
          websiteUrl: input.websiteUrl,
          companyName: input.companyName,
          timeoutMs,
        },
        input.countryId,
      );

      // Enforce the evidence requirement before persisting
      const result = enforceEvidenceRequirement(rawResult);
      checkResults.push(result);
    }

    // Derive the state from the enforced results
    const { state: derivedState } = deriveState(checkResults, VERIFICATION_RULE);

    return { state: derivedState, checkResults };
  }

  /**
   * Gets the verification state for a company.
   */
  async getVerificationState(companyId: string): Promise<{
    companyId: string;
    verificationState: string | null;
    verifiedAt: Date | null;
    verificationRunId: string | null;
  } | null> {
    try {
      const [company] = await this.database
        .select({
          companyId: companies.id,
          verificationState: companies.verificationState,
          verifiedAt: companies.verifiedAt,
          verificationRunId: companies.verificationRunId,
        })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      return company ?? null;
    } catch {
      // If the query fails (e.g., invalid UUID format), return null
      return null;
    }
  }
}
