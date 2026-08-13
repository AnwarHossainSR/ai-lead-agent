/**
 * Renders how long ago an ISO timestamp was, coarsest unit that still fits
 * (minutes, hours, days) — the needs-attention view's whole point is
 * surfacing what has been neglected longest, so the unit has to stay
 * legible at a glance rather than showing exact durations.
 */
export function formatAge(since: string, now: Date = new Date()): string {
  const elapsedMs = now.getTime() - new Date(since).getTime();
  const minutes = Math.floor(elapsedMs / (60 * 1000));

  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
