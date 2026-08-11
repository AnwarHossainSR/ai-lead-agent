import { validateCandidate, type DiscoveredCandidate } from "./source";
import type { DiscoveryRequest, DiscoverySource, DiscoverySourceResult } from "./source";

/**
 * Configuration for the places adapter.
 */
export interface PlacesSourceConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  /** Injected fetch for testing; defaults to global `fetch`. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * A raw business listing as returned by the places API.
 */
interface PlacesListing {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly website?: string;
  readonly city?: string;
  readonly employee_count?: number;
  readonly linkedin_url?: string;
  readonly description?: string;
}

/**
 * The places API response shape.
 */
interface PlacesApiResponse {
  readonly results: readonly PlacesListing[];
  readonly next_page_token?: string;
}

/**
 * The `places` source: a licensed business listings API (design D3).
 *
 * This source calls a third-party API using a licensed API key. It maps
 * the response to `DiscoveredCandidate` objects, using the API's own
 * record URL as the source URL.
 *
 * The source is disabled by default in configuration (task 7.4) — a
 * source that cannot be used should not look usable.
 */
export class PlacesSource implements DiscoverySource {
  readonly sourceId = "places";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(config: PlacesSourceConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.fetchFn = config.fetch ?? globalThis.fetch;
  }

  async fetch(request: DiscoveryRequest): Promise<DiscoverySourceResult> {
    if (!this.apiKey) {
      return {
        outcome: "failed",
        reason: "missing_places_api_key",
      };
    }

    try {
      const url = new URL("/businesses", this.baseUrl);
      url.searchParams.set("country", request.countryId);
      if (request.cityId) {
        url.searchParams.set("city", request.cityId);
      }
      url.searchParams.set("industry", request.industryId);
      url.searchParams.set("limit", "50");

      const response = await this.fetchFn(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });

      if (response.status === 403) {
        return {
          outcome: "blocked",
          note: "places API returned 403 Forbidden",
        };
      }

      if (response.status === 429) {
        return {
          outcome: "blocked",
          note: "places API returned 429 Too Many Requests",
        };
      }

      if (!response.ok) {
        return {
          outcome: "failed",
          reason: `places API returned HTTP ${response.status}`,
        };
      }

      const data = (await response.json()) as PlacesApiResponse;
      const candidates: DiscoveredCandidate[] = [];
      const rejections: Record<string, number> = {};

      for (const listing of data.results ?? []) {
        const candidate = {
          name: listing.name,
          sourceUrl: listing.url,
          website: listing.website,
          city: listing.city,
          companySize:
            listing.employee_count !== undefined
              ? String(listing.employee_count)
              : undefined,
          linkedinUrl: listing.linkedin_url,
          description: listing.description,
        };

        const result = validateCandidate(candidate);

        if (result.ok) {
          candidates.push(result.candidate);
        } else {
          rejections[result.reason] = (rejections[result.reason] ?? 0) + 1;
        }
      }

      return {
        outcome: "succeeded",
        candidates,
        rejections: Object.entries(rejections).map(([reason, count]) => ({
          reason,
          count,
        })),
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        outcome: "failed",
        reason: `places API request failed: ${message}`,
      };
    }
  }
}
