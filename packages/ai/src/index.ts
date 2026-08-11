/**
 * @mela/ai — the platform's only sanctioned path to a language model.
 *
 * Two layers: `AIProvider` is the thin transport over one vendor; `AIService`
 * is the only thing application code calls. Prompts are versioned modules
 * reviewed like code. Output is requested as structured data and always
 * parsed against the prompt's declared Zod schema — never coerced, never
 * defaulted. See docs/architecture.md.
 */

export { AIService, SpendCeilingError, type AIResult, type AIServiceConfig } from "./service/ai.service";
export { OutputValidationError } from "./service/validate";
export { estimateCost, modelForTier, type CostEstimate } from "./service/spend";

export type { AIProvider, AIToolDefinition, AIMessage, AITokenUsage } from "./provider/provider";
export { AIProviderError, AIProviderTimeoutError } from "./provider/errors";
export { GeminiProvider } from "./provider/gemini";
export { CloudflareProvider, type CloudflareCredentials } from "./provider/cloudflare";

export { resolvePrompt, listPrompts } from "./prompts/registry";
export type { PromptDefinition, RenderedPrompt } from "./prompts/prompt";
export { renderPrompt, isInputConfinedToBlock } from "./prompts/render";

export { FakeAIProvider, type FakeProviderScenario } from "./testing/fake-provider";
