/**
 * @mela/config — the single source of truth for domain vocabulary and for the
 * environment variables this project reads.
 *
 * Environment schemas are exported from `@mela/config/env` rather than here,
 * so importing the domain vocabulary never triggers environment validation.
 */

export { ConfigurationError } from "./internal/errors";

export * from "./product";

export type { ApiEnv, DatabaseEnv, WebEnv } from "./env";
