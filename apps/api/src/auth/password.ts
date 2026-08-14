import { AUTHENTICATION_CONFIG } from "@mela/config";
import * as argon2 from "argon2";

/**
 * Argon2id hashing at the parameters `AUTHENTICATION_CONFIG` declares
 * (design D3).
 */

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: AUTHENTICATION_CONFIG.argon2.memoryCostKib,
  timeCost: AUTHENTICATION_CONFIG.argon2.timeCost,
  parallelism: AUTHENTICATION_CONFIG.argon2.parallelism,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

/**
 * A hash of a password nobody has ever set, generated once at the same
 * Argon2id parameters `AUTHENTICATION_CONFIG` declares. Sign-in compares
 * against this whenever the email is not on file, so the branch taken is
 * which hash gets compared, not whether a comparison happens at all — the
 * response time does not disclose whether the account exists (design D3).
 *
 * Fixed rather than computed at boot: a lazily-computed dummy would make the
 * first refusal after a restart slower than every one after it, which is a
 * timing signal of its own.
 */
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,p=1,t=2$ODTwaIvBTryJ8JX9WdFJAA$ykPa2JeMf0wYpVEFUX43pcojkXM2dGKKmDroV4o5oKA";
