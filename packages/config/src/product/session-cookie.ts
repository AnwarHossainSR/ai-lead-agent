/**
 * The session cookie's name and security attributes (design D2/D7) — the one
 * source both `apps/api` (which issues it on sign-in) and `apps/web` (whose
 * middleware reads it and whose Server Action sets it) read, so neither
 * reimplements "secure outside development" on its own.
 */
export const SESSION_COOKIE_NAME = "mela_session";

export interface SessionCookieAttributes {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
}

/** `secure` outside development (design D2): a cookie without TLS is not a cookie worth protecting. */
export function sessionCookieAttributes(nodeEnv: string): SessionCookieAttributes {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv !== "development",
    path: "/",
  };
}
