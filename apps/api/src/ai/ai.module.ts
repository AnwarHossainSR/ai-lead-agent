import { type ApiEnv } from "@mela/config/env";
import { GeminiProvider, AIService, type AIServiceConfig } from "@mela/ai";
import { type Database, type Executor } from "@mela/database";
import { Global, Module } from "@nestjs/common";

import { API_ENV } from "../config/env.module";
import { DATABASE } from "../database/database.module";

/** Injection token for the AIService. */
export const AI_SERVICE = "AI_SERVICE";

/**
 * Provides `AIService` through Nest DI, built from the validated
 * environment (task 6.1).
 *
 * No HTTP routes — `AIService` is consumed by background jobs and future
 * Nest services, never directly by a controller in this change (task 6.2).
 * The module is `@Global` because every consumer needs the same singleton.
 */
@Global()
@Module({
  providers: [
    {
      provide: AI_SERVICE,
      inject: [API_ENV, DATABASE],
      useFactory: (env: ApiEnv, database: Database): AIService => {
        const config: AIServiceConfig = {
          maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
          timeoutMs: env.AI_TIMEOUT_MS,
          spendCeilingUsd: env.AI_SPEND_CEILING_USD,
          spendWindowHours: env.AI_SPEND_WINDOW_HOURS,
        };

        // Default tier — Gemini. The fast tier (Cloudflare) will be wired
        // when `AIService` supports per-tier provider dispatch.
        const provider = new GeminiProvider(env.GEMINI_API_KEY);

        return new AIService(provider, database as Executor, config);
      },
    },
  ],
  exports: [AI_SERVICE],
})
export class AIModule {}
