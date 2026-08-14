import { createHmac, randomBytes } from "node:crypto";

/** An opaque, high-entropy session token — this is the value the cookie carries. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * The value actually stored (design D2): an HMAC of the token, keyed by
 * `SESSION_SECRET`, never the token itself. A row read out of a backup, a
 * replica, or a careless query cannot be turned into a working session —
 * only the secret and the original token together reproduce it.
 */
export function hashSessionToken(secret: string, token: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}
