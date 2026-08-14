import { SESSION_COOKIE_NAME } from "@mela/config";
import { cookies } from "next/headers";

/**
 * The incoming request's session cookie, ready to forward to the API.
 *
 * Every server-side call this app makes to the API is on behalf of whoever
 * is looking at the page, so every one of them needs to carry the same
 * session the browser sent here — otherwise the API's guard (deny by
 * default) refuses every one of them with a 401 regardless of whether the
 * visitor is actually signed in.
 */
export async function sessionCookieHeader(): Promise<Record<string, string>> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;

    return token === undefined ? {} : { Cookie: `${SESSION_COOKIE_NAME}=${token}` };
  } catch {
    // Outside a request scope — e.g. a unit test calling a fetch helper
    // directly rather than through a real Next.js request. Nothing to
    // forward in that case; the caller's own fetch mock doesn't care.
    return {};
  }
}
