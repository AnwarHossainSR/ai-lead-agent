import { z } from "zod";

import { parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";

const SUBJECT = "Authentication configuration";

export const authenticationConfigSchema = z
  .object({
    /** Sliding session lifetime: extended on activity, in minutes. */
    sessionLifetimeMinutes: z.number().int().positive(),
    /** Hard ceiling on a session's age regardless of activity, in minutes. */
    sessionAbsoluteMaxLifetimeMinutes: z.number().int().positive(),
    argon2: z.object({
      /** Memory cost in KiB. */
      memoryCostKib: z.number().int().positive(),
      timeCost: z.number().int().positive(),
      parallelism: z.number().int().positive(),
    }),
    rateLimit: z.object({
      windowMinutes: z.number().int().positive(),
      maxAttemptsPerAccount: z.number().int().positive(),
      maxAttemptsPerSource: z.number().int().positive(),
    }),
    /** Minimum accepted password length. */
    minimumPasswordLength: z.number().int().positive(),
  })
  .refine((config) => config.sessionAbsoluteMaxLifetimeMinutes >= config.sessionLifetimeMinutes, {
    message: "sessionAbsoluteMaxLifetimeMinutes must be at least sessionLifetimeMinutes.",
  });

export type AuthenticationConfig = z.infer<typeof authenticationConfigSchema>;

export function parseAuthenticationConfig(raw: unknown): AuthenticationConfig {
  return deepFreeze(parseOrThrow(SUBJECT, authenticationConfigSchema, raw));
}

/**
 * Argon2id parameters at OWASP's minimum recommendation for this algorithm
 * (19 MiB memory, 2 iterations, 1 degree of parallelism) — chosen because it
 * is deliberately expensive to brute-force while remaining sub-second on
 * commodity hardware for a single sign-in.
 */
const DEFAULT_AUTHENTICATION_CONFIG_RAW = {
  sessionLifetimeMinutes: 60 * 12,
  sessionAbsoluteMaxLifetimeMinutes: 60 * 24 * 7,
  argon2: {
    memoryCostKib: 19 * 1024,
    timeCost: 2,
    parallelism: 1,
  },
  rateLimit: {
    windowMinutes: 15,
    maxAttemptsPerAccount: 5,
    maxAttemptsPerSource: 20,
  },
  minimumPasswordLength: 12,
} as const;

export const AUTHENTICATION_CONFIG = parseAuthenticationConfig(DEFAULT_AUTHENTICATION_CONFIG_RAW);
