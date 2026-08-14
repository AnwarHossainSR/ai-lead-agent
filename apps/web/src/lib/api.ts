/**
 * Builds a URL under the API's `/api` prefix from `API_URL` (design D6).
 * Returns null when `API_URL` isn't configured, so a caller can render that
 * as its own condition rather than attempting a fetch that cannot succeed.
 *
 * `/health` sits outside the `/api` prefix and is not served by this
 * helper — see `lib/health.ts`.
 */
export function apiUrl(path: string): string | null {
  const base = process.env.API_URL;

  if (!base) {
    return null;
  }

  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}/api${suffix}`;
}
