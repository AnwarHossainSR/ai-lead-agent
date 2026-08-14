import { z } from "zod";

import { parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";

const SUBJECT = "Observability configuration";

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/**
 * Regex patterns for values that must be replaced in log output. Applied by
 * the serializer at write time, not at call sites.
 */
const REDACTION_PATTERNS_DATA = {
  /** postgres://, postgresql://, redis://, rediss:// URLs. */
  connectionStrings: /(?:postgres(?:ql)?|rediss?):\/\/[^\s"'}{,)]+/gi,
  /** Email addresses. */
  emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  /** Keys named as credential holders at any depth. */
  credentialKeys: /^(?:password|token|secret|authorization|cookie|apiKey)$/i,
} as const;

export type RedactionPatterns = typeof REDACTION_PATTERNS_DATA;

/**
 * Configured secret values redacted by exact string match. These are the
 * values the environment loader already holds; replacing them wherever they
 * appear — however they got there — is the safety net.
 */
const SECRET_VALUES_DATA: readonly string[] = [];

export const redactionConfigSchema = z.object({
  patterns: z.record(z.string(), z.instanceof(RegExp)),
  secretValues: z.array(z.string()),
  maxLength: z
    .number()
    .int()
    .positive()
    .describe("Truncate strings longer than this with a marker."),
});

export type RedactionConfig = z.infer<typeof redactionConfigSchema>;

// ---------------------------------------------------------------------------
// Metric label sets
// ---------------------------------------------------------------------------

/**
 * Bounded sets of label values for metrics. Every label on every metric must
 * draw from a configured set; no label may carry a company identifier, URL
 * or email address (both a cardinality rule and a privacy one).
 *
 * The actual runtime sets are populated from other product configs at the
 * callsite; these schemas define the shape and constraints.
 */
export const metricLabelSetSchema = z.object({
  /** Pipeline stage identifiers (e.g. discovery, verification, scoring). */
  stages: z.array(z.string()).min(1, "Expected at least one stage."),
  /** Outcome identifiers (e.g. completed, blocked, failed). */
  outcomes: z.array(z.string()).min(1, "Expected at least one outcome."),
  /** Discovery source identifiers. */
  sources: z.array(z.string()).min(1, "Expected at least one source."),
  /** AI prompt identifiers. */
  prompts: z.array(z.string()).min(1, "Expected at least one prompt."),
  /** AI model identifiers. */
  models: z.array(z.string()).min(1, "Expected at least one model."),
  /** Background job queue names. */
  queues: z.array(z.string()).min(1, "Expected at least one queue."),
  /** HTTP methods. */
  methods: z.array(z.string()).min(1, "Expected at least one HTTP method."),
  /** HTTP status code ranges (e.g. "2xx", "4xx", "5xx"). */
  statusRanges: z.array(z.string()).min(1, "Expected at least one status range."),
  /** Database pool connection states. */
  poolStates: z.array(z.string()).min(1, "Expected at least one pool state."),
});

export type MetricLabelSet = z.infer<typeof metricLabelSetSchema>;

// ---------------------------------------------------------------------------
// Observability config
// ---------------------------------------------------------------------------

export const observabilityConfigSchema = z.object({
  redaction: redactionConfigSchema,
  labels: metricLabelSetSchema,
  metricsEnabled: z
    .boolean()
    .default(true)
    .describe("Whether to expose Prometheus metrics on the metrics port."),
});

export type ObservabilityConfig = z.infer<typeof observabilityConfigSchema>;

export function parseObservabilityConfig(raw: unknown): ObservabilityConfig {
  return deepFreeze(parseOrThrow(SUBJECT, observabilityConfigSchema, raw));
}

/**
 * Registers a secret value for redaction. Called by the env loader after
 * validation so the exact strings of DATABASE_URL, GEMINI_API_KEY, etc.
 * are known and can be replaced wherever they appear.
 */
export function registerSecretForRedaction(
  config: ObservabilityConfig,
  secret: string,
): ObservabilityConfig {
  if (secret.length === 0) return config;

  const secrets = [...config.redaction.secretValues];
  if (!secrets.includes(secret)) {
    secrets.push(secret);
  }

  return parseObservabilityConfig({
    ...config,
    redaction: { ...config.redaction, secretValues: secrets },
  });
}

/**
 * Default pipeline stages derived from the job registry. These are the stages
 * whose outcomes are counted by the metrics layer.
 */
const PIPELINE_STAGES = [
  "discovery",
  "verification",
  "website-analysis",
  "technology-detection",
  "opportunity-analysis",
  "contact-research",
  "scoring",
  "research-summary",
  "reply-classification",
] as const;

/**
 * Default outcome values. The pipeline records honest outcomes at every stage;
 * these are the values that appear in counters.
 */
const OUTCOMES = [
  "completed",
  "blocked",
  "unreachable",
  "below_threshold",
  "insufficient_evidence",
  "limit_reached",
  "failed",
  "timeout",
] as const;

const SOURCES = ["file_import", "places", "business_directory"] as const;

const PROMPTS = [
  "website-analysis",
  "technology-detection",
  "opportunity-analysis",
  "contact-research",
  "research-summary",
  "reply-classification",
] as const;

const MODELS = ["gemini-2.5-pro", "llama-3.3-70b"] as const;

const QUEUES = [
  "discovery",
  "verification",
  "website-analysis",
  "technology-detection",
  "opportunity-analysis",
  "contact-research",
  "scoring",
  "research-summary",
  "reply-classification",
] as const;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const STATUS_RANGES = ["2xx", "3xx", "4xx", "5xx"] as const;

const POOL_STATES = ["idle", "active", "waiting", "closed"] as const;

const DEFAULT_LABELS: MetricLabelSet = {
  stages: [...PIPELINE_STAGES],
  outcomes: [...OUTCOMES],
  sources: [...SOURCES],
  prompts: [...PROMPTS],
  models: [...MODELS],
  queues: [...QUEUES],
  methods: [...METHODS],
  statusRanges: [...STATUS_RANGES],
  poolStates: [...POOL_STATES],
};

const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  patterns: { ...REDACTION_PATTERNS_DATA },
  secretValues: [...SECRET_VALUES_DATA],
  maxLength: 10_000,
};

export const OBSERVABILITY_CONFIG = parseObservabilityConfig({
  redaction: DEFAULT_REDACTION_CONFIG,
  labels: DEFAULT_LABELS,
  metricsEnabled: true,
});
