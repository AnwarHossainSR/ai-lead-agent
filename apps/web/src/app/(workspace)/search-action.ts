"use server";

import type { FetchResult } from "@/lib/fetch-with-timeout";
import { type SearchResults, searchWorkspace } from "@/lib/search";

/**
 * The command palette's read path.
 *
 * A Server Action rather than a client fetch because `API_URL` and the session
 * cookie are both server-side: exposing either to the browser to save one hop
 * would be trading the app's auth model for a round trip.
 *
 * The result keeps its `degraded`/`unreachable` distinction all the way to the
 * palette, which renders `Unavailable` — so a search that fails says which way
 * it failed rather than looking like a search that found nothing.
 */
export async function searchWorkspaceAction(query: string): Promise<FetchResult<SearchResults>> {
  return searchWorkspace(query);
}
