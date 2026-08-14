import { fetchAwaitingReview } from "@/app/(workspace)/outreach/review/awaiting-review";
import { NAV_COUNT_CAP, type NavigationCounts } from "@/components/navigation";

/**
 * The counts the shell shows beside a navigation entry.
 *
 * Read once in the layout, on every page, so it must not be able to slow the
 * whole app down or take it out: `fetchAwaitingReview` is already bounded by
 * the standard timeout, and a failure returns an **empty record** rather than
 * a zero (design D8). An entry with no count renders no badge, which says
 * nothing is known; a badge reading zero would say the queue is empty.
 *
 * One more than the cap is requested, which is what lets the badge tell
 * "exactly 99" from "at least 99".
 */
export async function readNavigationCounts(): Promise<NavigationCounts> {
  const result = await fetchAwaitingReview(NAV_COUNT_CAP + 1);

  if (result.status !== "ok") {
    return {};
  }

  return { outreachReview: result.data.length };
}
