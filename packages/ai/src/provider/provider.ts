/**
 * The thin transport interface over one vendor (design D2).
 *
 * `AIProvider` knows about messages, tokens and HTTP failures. It knows
 * nothing about prompts, schemas, versions or cost ceilings — that is
 * `AIService`'s job, one layer up. Two implementations satisfy this:
 * `gemini.ts` for the default tier, `cloudflare.ts` for the fast tier
 * (design D3).
 */

export type AIMessageRole = "system" | "user";

/** One rendered message. Instructions and input arrive as separate messages — never concatenated (design D5). */
export interface AIMessage {
  readonly role: AIMessageRole;
  readonly content: string;
}

/**
 * A JSON Schema, offered to the vendor as the single tool it must call
 * (design D4). Constrains generation at the provider; the Zod parse
 * afterwards is still the contract, not this.
 */
export interface AIToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface AITokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface AIProviderRequest {
  readonly messages: readonly AIMessage[];
  readonly tool: AIToolDefinition;
  readonly model: string;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}

export interface AIProviderResponse {
  /** The tool call's arguments — unknown until `AIService` parses it against the prompt's output schema. */
  readonly content: unknown;
  readonly usage: AITokenUsage;
}

export interface AIProvider {
  request(request: AIProviderRequest): Promise<AIProviderResponse>;
}
