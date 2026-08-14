import { EnvironmentValidationError } from "./load";

/**
 * The value committed in `.env.example`. Fine for local development — it is
 * never used to protect anything reachable from outside the developer's own
 * machine — but a startup guard outside development, where it is a real
 * credential.
 */
export const SESSION_SECRET_PLACEHOLDER =
  "changeme-generate-a-real-secret-with-openssl-rand-hex-32";

/** Below this length a secret is brute-forceable; 32 characters is the OWASP floor for a signing key. */
export const MINIMUM_SESSION_SECRET_LENGTH = 32;

function refuse(problem: string): never {
  const message = [
    "Invalid environment configuration for the API.",
    "",
    "  SESSION_SECRET",
    "    Purpose: Secret used to sign session cookies.",
    `    Problem: ${problem}`,
    "",
    "Set this in the git-ignored local environment file. See .env.example for the full list.",
  ].join("\n");

  throw new EnvironmentValidationError("the API", ["SESSION_SECRET"], message);
}

/**
 * Refuses startup outside development when the session secret is short or
 * equal to the committed placeholder. A missing secret is already refused by
 * the schema itself (`SESSION_SECRET` has no default) before this ever runs.
 */
export function assertSessionSecretIsSafe(env: { NODE_ENV: string; SESSION_SECRET: string }): void {
  if (env.NODE_ENV === "development") {
    return;
  }

  if (env.SESSION_SECRET.length < MINIMUM_SESSION_SECRET_LENGTH) {
    refuse(`Expected at least ${MINIMUM_SESSION_SECRET_LENGTH} characters outside development.`);
  }

  if (env.SESSION_SECRET === SESSION_SECRET_PLACEHOLDER) {
    refuse("The committed placeholder may not be used outside development.");
  }
}
