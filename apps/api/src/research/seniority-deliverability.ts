import { type SeniorityLevel, classifyRole } from "@mela/config";

/**
 * Seniority classification result.
 */
export interface SeniorityClassification {
  readonly levelId: string;
  readonly level: SeniorityLevel | null;
}

/**
 * Classifies a job title against configured role patterns.
 *
 * Returns the matching seniority level, or "unknown" if no pattern matches.
 * Returns null level if no title is provided.
 */
export function classifySeniority(jobTitle: string | null): SeniorityClassification {
  if (jobTitle === null || jobTitle.trim() === "") {
    return { levelId: "unknown", level: null };
  }

  const levelId = classifyRole(jobTitle);
  const level = levelId === "unknown" ? null : { id: levelId, displayName: levelId, rank: 0 };

  return { levelId, level };
}

/**
 * Mail deliverability check result.
 */
export interface DeliverabilityCheck {
  readonly domain: string;
  readonly status: "receivable" | "not_receivable" | "unknown";
}

/**
 * Cache for MX lookup results.
 */
const mxCache = new Map<string, DeliverabilityCheck>();

/**
 * Checks mail deliverability for a domain by looking up MX records.
 *
 * Does NOT open an SMTP session, issue a recipient probe, or send a message.
 * Returns "unknown" on lookup failure or timeout.
 */
export async function checkDeliverability(domain: string): Promise<DeliverabilityCheck> {
  // Check cache first
  const cached = mxCache.get(domain);
  if (cached !== undefined) {
    return cached;
  }

  try {
    // Use DNS-over-HTTPS to lookup MX records
    const response = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { signal: AbortSignal.timeout(5000) },
    );

    const data = (await response.json()) as {
      Answer?: Array<{ type?: number; data?: string }>;
    };

    if (data.Answer && Array.isArray(data.Answer)) {
      const mxRecords = data.Answer.filter((r: { type?: number }) => r.type === 15);

      const result: DeliverabilityCheck = {
        domain,
        status: mxRecords.length > 0 ? "receivable" : "not_receivable",
      };

      mxCache.set(domain, result);
      return result;
    }

    const result: DeliverabilityCheck = { domain, status: "not_receivable" };
    mxCache.set(domain, result);
    return result;
  } catch {
    const result: DeliverabilityCheck = { domain, status: "unknown" };
    mxCache.set(domain, result);
    return result;
  }
}

/**
 * Clears the MX lookup cache.
 */
export function clearDeliverabilityCache(): void {
  mxCache.clear();
}
