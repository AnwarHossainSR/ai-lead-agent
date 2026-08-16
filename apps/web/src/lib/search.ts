import { apiUrl } from "@/lib/api";
import { type FetchResult, fetchWithTimeout } from "@/lib/fetch-with-timeout";

/** One matched record, in the shape `GET /api/search` returns it. */
export interface SearchHit {
  readonly id: string;
  readonly name: string;
  /** What distinguishes this hit — a domain, a company name, a city. */
  readonly detail: string | null;
}

export interface SearchResults {
  readonly query: string;
  readonly companies: readonly SearchHit[];
  readonly leads: readonly SearchHit[];
  /** How many matches were found before the cap, so a capped list says so. */
  readonly totalMatches: number;
}

/** Long enough for a typed query, short enough that the palette stays live. */
const SEARCH_TIMEOUT_MS = 1500;

/**
 * Companies and leads matching a query.
 *
 * Read on the server — `API_URL` and the session cookie both live there — and
 * reached from the browser through the Server Action in
 * `app/(workspace)/search-action.ts`, so the palette never needs the API's
 * address or a copy of the session.
 */
export async function searchWorkspace(query: string): Promise<FetchResult<SearchResults>> {
  const trimmed = query.trim();
  if (trimmed === "") {
    return { status: "ok", data: { query: "", companies: [], leads: [], totalMatches: 0 } };
  }

  const url = apiUrl(`/search?q=${encodeURIComponent(trimmed)}`);
  if (url === null) {
    return { status: "unreachable", error: "API_URL is not configured." };
  }

  return fetchWithTimeout<SearchResults>(url, { timeoutMs: SEARCH_TIMEOUT_MS });
}
