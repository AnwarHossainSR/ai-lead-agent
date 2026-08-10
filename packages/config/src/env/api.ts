import { z } from "zod";

import { httpUrl, postgresUrl, redisUrl, tcpPort } from "./fields";
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
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const loadApiEnv = createEnvLoader("the API", apiEnvSchema);
