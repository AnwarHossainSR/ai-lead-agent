/**
 * Shared HTTP politeness primitives.
 *
 * robots.txt evaluation, per-host rate limiting, and block detection live here
 * because they serve both the discovery and verification modules.  Discovery
 * and verification import from this module; the politeness test asserts no
 * evasion surface is exposed.
 */

export { parseRobotsTxt, RobotsPolicy, RobotsService } from "./robots";
export type { RobotsFetcher, RobotsGroup, RobotsRule } from "./robots";

export { effectiveRequestIntervalMs, TokenBucket } from "./rate-limiter";

export { detectBlock } from "./block-detection";
export type { BlockVerdict } from "./block-detection";
