import { apiUrl } from "@/lib/api";
import { type FetchResult, fetchWithTimeout } from "@/lib/fetch-with-timeout";
import type { OutreachRecord } from "@/lib/outreach";

/**
 * Every message an operator still has to act on: `pending_approval` (drafted
 * and explicitly submitted) and `draft` (drafted, never submitted — approval
 * is already reachable directly from `draft` at the database layer, and
 * nothing in this application exposes a separate submit action, so a draft
 * that never gets explicitly submitted must still be reachable here or it is
 * simply invisible). Merged and re-sorted newest-first, matching the API's
 * own default ordering for a single status.
 */
export async function fetchAwaitingReview(limit: number): Promise<FetchResult<OutreachRecord[]>> {
  const pendingUrl = apiUrl(`/outreach?status=pending_approval&limit=${limit}`);
  const draftUrl = apiUrl(`/outreach?status=draft&limit=${limit}`);

  if (pendingUrl === null || draftUrl === null) {
    return { status: "unreachable", error: "API_URL is not configured." };
  }

  const [pendingResult, draftResult] = await Promise.all([
    fetchWithTimeout<OutreachRecord[]>(pendingUrl),
    fetchWithTimeout<OutreachRecord[]>(draftUrl),
  ]);

  if (pendingResult.status !== "ok") {
    return pendingResult;
  }
  if (draftResult.status !== "ok") {
    return draftResult;
  }

  const merged = [...pendingResult.data, ...draftResult.data].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );

  return { status: "ok", data: merged.slice(0, limit) };
}
