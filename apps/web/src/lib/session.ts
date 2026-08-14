import { apiUrl } from "./api";
import { sessionCookieHeader } from "./session-cookie";

export interface CurrentAccount {
  readonly id: string;
  readonly email: string;
  readonly role: "operator" | "viewer";
}

/**
 * The signed-in account for the current request, resolved against the API
 * (`GET /api/auth/me`) rather than just decoded from the cookie — this app
 * has no way to validate a session token itself (the secret it's hashed
 * with lives only in `apps/api`), and a cookie that merely exists is not
 * the same as a cookie the API still honours (expired, revoked, or the
 * account since disabled). Returns `null` for anything short of a fully
 * valid session — an absent cookie, an unreachable API, or a 401 — so every
 * caller has exactly one condition to check.
 */
export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  const url = apiUrl("/auth/me");
  if (url === null) {
    return null;
  }

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: await sessionCookieHeader(),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CurrentAccount;
  } catch {
    return null;
  }
}
