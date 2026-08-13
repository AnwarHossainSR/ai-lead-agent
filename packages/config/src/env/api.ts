import { z } from "zod";

import { httpUrl, positiveAmount, positiveInteger, postgresUrl, redisUrl, tcpPort } from "./fields";
import { createEnvLoader } from "./load";

/** Everything the NestJS API reads at startup. */
export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development")
    .describe(
      "Runtime mode. Anything other than development emits structured JSON logs instead of pretty console output.",
    ),

  // Zod 4's .default() takes the *output* type and skips the pipeline, so this
  // is the parsed number rather than the string an env file would carry.
  API_PORT: tcpPort
    .default(3001)
    .describe(
      "TCP port the API listens on. Must match the port in API_URL and NEXT_PUBLIC_API_URL.",
    ),

  DATABASE_URL: postgresUrl.describe(
    "PostgreSQL connection string for the application database. Never logged, never returned in a health response.",
  ),

  REDIS_URL: redisUrl.describe(
    "Redis connection string. Used today only by the health check; the background job queues arrive in a later phase.",
  ),

  WEB_ORIGIN: httpUrl
    .default("http://localhost:3000")
    .describe(
      "Origin the web application is served from. The API permits CORS requests from it and no other.",
    ),

  // Two vendors, one per tier — not a runtime-selectable "AI_PROVIDER". The
  // default tier's evidence-weighted reasoning runs on Gemini; the fast
  // tier's cheap classification runs on Cloudflare Workers AI.
  GEMINI_API_KEY: z
    .string()
    .trim()
    .min(1, "Expected the Gemini API key.")
    .describe(
      "Google Gemini API key, used for the default tier. Secret — never logged, never returned in a health response, never present in an error message.",
    ),

  CLOUDFLARE_ACCOUNT_ID: z
    .string()
    .trim()
    .min(1, "Expected the Cloudflare account id.")
    .describe("Cloudflare account id. Workers AI is called at a URL scoped to this account."),

  CLOUDFLARE_API_TOKEN: z
    .string()
    .trim()
    .min(1, "Expected the Cloudflare API token.")
    .describe(
      "Cloudflare API token scoped to Workers AI, used for the fast tier. Secret — never logged, never returned in a health response, never present in an error message.",
    ),

  AI_MODEL_DEFAULT: z
    .string()
    .trim()
    .min(1)
    .default("gemini-2.5-pro")
    .describe(
      "Gemini model identifier for the default tier: evidence-weighted reasoning over research and analysis.",
    ),

  AI_MODEL_FAST: z
    .string()
    .trim()
    .min(1)
    .default("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
    .describe(
      "Cloudflare Workers AI model identifier for the fast tier: cheap classification and short extraction. Must be a model in Cloudflare's catalog that supports function calling — that is how structured output is requested (design D4).",
    ),

  AI_MAX_OUTPUT_TOKENS: positiveInteger
    .default(4_096)
    .describe("Maximum output tokens requested per model call."),

  AI_TIMEOUT_MS: positiveInteger
    .default(60_000)
    .describe(
      "Bound on a single model call, in milliseconds. These are long analytical calls, not request-path work.",
    ),

  AI_SPEND_CEILING_USD: positiveAmount
    .default(20)
    .describe(
      "Maximum estimated spend permitted within AI_SPEND_WINDOW_HOURS before calls are refused.",
    ),

  AI_SPEND_WINDOW_HOURS: positiveInteger
    .default(24)
    .describe("Rolling window, in hours, over which AI_SPEND_CEILING_USD is enforced."),

  // ---------------------------------------------------------------------------
  // Discovery sources
  // ---------------------------------------------------------------------------

  PLACES_API_KEY: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "API key for the licensed places provider. When absent the places source is disabled for the run.",
    ),

  PLACES_BASE_URL: httpUrl
    .default("https://api.places.example.com/v1")
    .describe("Base URL for the licensed places provider."),

  // ---------------------------------------------------------------------------
  // Website analysis
  // ---------------------------------------------------------------------------

  ANALYSIS_ARTIFACT_ROOT: z
    .string()
    .min(1, "Expected a path for ANALYSIS_ARTIFACT_ROOT.")
    .default("./analysis-artifacts")
    .describe(
      "Directory where analysis artifacts (screenshots, HTML, audit reports) are stored. Created at startup if absent.",
    ),

  ANALYSIS_NAVIGATION_TIMEOUT_MS: positiveInteger
    .default(30_000)
    .describe(
      "Maximum time in milliseconds to wait for a page to reach its load condition. Exceeding this ends the analysis with a timeout reason.",
    ),

  ANALYSIS_RUN_TIMEOUT_MS: positiveInteger
    .default(120_000)
    .describe(
      "Maximum total time in milliseconds for an entire analysis run including capture and audit. Exceeding this ends the analysis with a timeout reason.",
    ),

  ANALYSIS_MAX_PAGE_BYTES: positiveInteger
    .default(10 * 1024 * 1024)
    .describe(
      "Maximum allowed page weight in bytes. Exceeding this ends the analysis with a weight limit reason.",
    ),

  WORKER_SHUTDOWN_TIMEOUT_MS: positiveInteger
    .default(30_000)
    .describe(
      "Maximum time in milliseconds the worker waits for active jobs to finish during graceful shutdown.",
    ),

  QSTASH_URL: httpUrl
    .default("https://qstash-eu-central-1.upstash.io")
    .describe("QStash base URL for background job delivery."),

  QSTASH_TOKEN: z
    .string()
    .trim()
    .min(1, "Expected the QStash token.")
    .describe(
      "Upstash QStash bearer token. Secret — never logged, never returned in a health response, never present in an error message.",
    ),

  QSTASH_CURRENT_SIGNING_KEY: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Current QStash signing key used to verify inbound webhook signatures.",
    ),

  QSTASH_NEXT_SIGNING_KEY: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      "Next QStash signing key for rotation. Verified when present, ignored otherwise.",
    ),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const loadApiEnv = createEnvLoader("the API", apiEnvSchema);
