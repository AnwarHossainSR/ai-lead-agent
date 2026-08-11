import { insertAIInvocation, spendInWindow, type Executor } from "@mela/database";

import { resolvePrompt } from "../prompts/registry";
import type { PromptDefinition } from "../prompts/prompt";
import type { AIProvider, AIProviderRequest } from "../provider/provider";
import { AIProviderError } from "../provider/errors";
import { estimateCost, modelForTier } from "./spend";
import { parseOutput, failingFields, OutputValidationError } from "./validate";

/**
 * Configuration passed to `AIService` by the NestJS module (design D1/D2).
 * Every value comes from the validated environment — the service never reads
 * `process.env` directly.
 */
export interface AIServiceConfig {
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  readonly spendCeilingUsd: number;
  readonly spendWindowHours: number;
}

/**
 * The result returned to callers. Carries the parsed output and the
 * invocation record's identifier so derived values can reference it
 * (design D6).
 */
export interface AIResult<T> {
  readonly value: T;
  readonly invocationId: string;
}

/**
 * The only public entry point for model calls (design D2). Application
 * code calls `run`, passing a registered prompt name and version with
 * typed input. The service handles rendering, provider selection, schema
 * validation (with one repair attempt), cost estimation, spend-ceiling
 * enforcement, and invocation recording.
 *
 * This class knows nothing about HTTP — it receives an `AIProvider` and
 * an `Executor` through its constructor.
 */
export class AIService {
  constructor(
    private readonly provider: AIProvider,
    private readonly executor: Executor,
    private readonly config: AIServiceConfig,
  ) {}

  /**
   * Runs a registered prompt against the model. The full lifecycle:
   *
   * 1. Resolve the prompt definition from the registry
   * 2. Check the spend ceiling (design D7)
   * 3. Render the prompt into messages + tool definition
   * 4. Call the provider
   * 5. Parse the response against the output schema (with one repair
   *    attempt on validation failure — design D4)
   * 6. Record the invocation
   * 7. Return the parsed value + invocation ID
   */
  async run<T>(
    promptName: string,
    promptVersion: number,
    input: unknown,
  ): Promise<AIResult<T>> {
    const def = resolvePrompt(promptName, promptVersion);
    const model = modelForTier(def.tier);

    // Design D7: check ceiling before sending
    await this.assertCeilingNotReached(def);

    // Render the prompt
    const rendered = def.render(input);

    // Build the provider request
    const request: AIProviderRequest = {
      messages: rendered.messages,
      tool: rendered.tool,
      model,
      maxOutputTokens: this.config.maxOutputTokens,
      timeoutMs: this.config.timeoutMs,
    };

    // Call with validation + one repair attempt
    const startTime = Date.now();
    let attempts = 1;
    let content: unknown;
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      const response = await this.provider.request(request);
      content = response.content;
      usage = response.usage;

      // First validation attempt
      const firstParse = parseOutput(def.outputSchema, content);
      if (firstParse.ok) {
        const latencyMs = Date.now() - startTime;
        const cost = estimateCost(def.tier, usage);

        const invocation = await insertAIInvocation(this.executor, {
          promptName: def.name,
          promptVersion: def.version,
          model,
          tier: def.tier,
          inputTokens: cost.inputTokens,
          outputTokens: cost.outputTokens,
          estimatedCostUsd: cost.estimatedCostUsd,
          latencyMs,
          attempts,
          outcome: "succeeded",
        });

        return { value: firstParse.value as T, invocationId: invocation.id };
      }

      // Repair attempt: send the validation error back to the model
      attempts = 2;
      const repairMessage =
        `The previous response failed schema validation. ` +
        `Failing fields: ${failingFields(firstParse.error).join(", ")}. ` +
        `Please respond with a corrected JSON object matching the tool schema.`;

      const repairRequest: AIProviderRequest = {
        ...request,
        messages: [
          ...request.messages,
          { role: "user", content: repairMessage },
        ],
      };

      const repairResponse = await this.provider.request(repairRequest);
      content = repairResponse.content;
      usage = repairResponse.usage;

      const secondParse = parseOutput(def.outputSchema, content);
      if (secondParse.ok) {
        const latencyMs = Date.now() - startTime;
        const cost = estimateCost(def.tier, usage);

        const invocation = await insertAIInvocation(this.executor, {
          promptName: def.name,
          promptVersion: def.version,
          model,
          tier: def.tier,
          inputTokens: cost.inputTokens,
          outputTokens: cost.outputTokens,
          estimatedCostUsd: cost.estimatedCostUsd,
          latencyMs,
          attempts,
          outcome: "succeeded",
        });

        return { value: secondParse.value as T, invocationId: invocation.id };
      }

      // Second failure — throw
      const latencyMs = Date.now() - startTime;
      const cost = estimateCost(def.tier, usage);

      await insertAIInvocation(this.executor, {
        promptName: def.name,
        promptVersion: def.version,
        model,
        tier: def.tier,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        estimatedCostUsd: cost.estimatedCostUsd,
        latencyMs,
        attempts,
        outcome: "invalid_output",
        failureCode: "schema_validation_failed",
      });

      throw new OutputValidationError(
        def.name,
        def.version,
        failingFields(secondParse.error),
        secondParse.error,
      );
    } catch (error) {
      // If it's an OutputValidationError or a SpendCeilingError, rethrow
      if (
        error instanceof OutputValidationError ||
        error instanceof SpendCeilingError
      ) {
        throw error;
      }

      // Provider error — record it
      const latencyMs = Date.now() - startTime;
      const cost = estimateCost(def.tier, usage);
      const failureCode =
        error instanceof AIProviderError ? error.condition : "unknown";

      await insertAIInvocation(this.executor, {
        promptName: def.name,
        promptVersion: def.version,
        model,
        tier: def.tier,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        estimatedCostUsd: cost.estimatedCostUsd,
        latencyMs,
        attempts,
        outcome: "provider_error",
        failureCode,
      });

      throw error;
    }
  }

  /**
   * Checks the spend ceiling before each call (design D7). When the
   * ceiling is reached, refuses with an error naming the ceiling and the
   * window — and records the refusal.
   */
  private async assertCeilingNotReached(
    def: PromptDefinition,
  ): Promise<void> {
    const spent = await spendInWindow(
      this.executor,
      this.config.spendWindowHours,
    );

    if (spent >= this.config.spendCeilingUsd) {
      const model = modelForTier(def.tier);

      await insertAIInvocation(this.executor, {
        promptName: def.name,
        promptVersion: def.version,
        model,
        tier: def.tier,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: 0,
        attempts: 1,
        outcome: "refused_by_ceiling",
        failureCode: "spend_ceiling_reached",
      });

      throw new SpendCeilingError(this.config.spendCeilingUsd, this.config.spendWindowHours);
    }
  }
}

/**
 * Raised when the spend ceiling is reached (design D7). Names the ceiling
 * and the window so the caller knows why the call was refused.
 */
export class SpendCeilingError extends Error {
  readonly ceilingUsd: number;
  readonly windowHours: number;

  constructor(ceilingUsd: number, windowHours: number) {
    super(
      `Spend ceiling reached: $${ceilingUsd.toFixed(2)} over the last ${windowHours}h window. ` +
        "No further model calls are permitted until spend drops below the ceiling.",
    );
    this.name = "SpendCeilingError";
    this.ceilingUsd = ceilingUsd;
    this.windowHours = windowHours;
  }
}
