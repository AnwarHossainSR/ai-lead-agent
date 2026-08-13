import type * as GenAI from "@google/genai" with { "resolution-mode": "import" };

import { type AIProviderConditionType, AIProviderError, AIProviderTimeoutError } from "./errors";
import type { AIMessage, AIProvider, AIProviderRequest, AIProviderResponse } from "./provider";
import { withRetry } from "./retry";

/**
 * `@google/genai` ships ESM-only; this package (like the rest of the
 * monorepo) is CommonJS. A static value `import` here would fail to compile
 * (TS1479), so the module is loaded once, lazily, via dynamic `import()`,
 * which Node's CJS runtime supports natively. Only the type is imported
 * statically — with the `resolution-mode` required to read types out of an
 * ESM package from a CJS file under Node16 resolution.
 */
type GenAIModule = typeof GenAI;

function loadGenAI(): Promise<GenAIModule> {
  return import("@google/genai");
}

interface GeminiClient {
  readonly module: GenAIModule;
  readonly client: InstanceType<GenAIModule["GoogleGenAI"]>;
}

/**
 * The default tier's transport (design D3). One call per `request()`: the
 * tool definition is passed with `FunctionCallingConfigMode.ANY`, which
 * forces the model to call it rather than reply in prose — that is how D4's
 * structured-output contract holds for Gemini specifically.
 */
export class GeminiProvider implements AIProvider {
  private readonly apiKey: string;
  private ready: Promise<GeminiClient> | undefined;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private client(): Promise<GeminiClient> {
    this.ready ??= loadGenAI().then((module) => ({
      module,
      client: new module.GoogleGenAI({ apiKey: this.apiKey }),
    }));
    return this.ready;
  }

  async request(request: AIProviderRequest): Promise<AIProviderResponse> {
    return withRetry(() => this.attempt(request));
  }

  private async attempt(request: AIProviderRequest): Promise<AIProviderResponse> {
    const { module, client } = await this.client();
    const { systemInstruction, contents } = toContents(request.messages);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);

    try {
      const response = await client.models.generateContent({
        model: request.model,
        contents,
        config: {
          abortSignal: controller.signal,
          maxOutputTokens: request.maxOutputTokens,
          systemInstruction,
          tools: [{ functionDeclarations: [toFunctionDeclaration(request.tool)] }],
          toolConfig: {
            functionCallingConfig: {
              mode: module.FunctionCallingConfigMode.ANY,
              allowedFunctionNames: [request.tool.name],
            },
          },
        },
      });

      const content = response.functionCalls?.[0]?.args;

      if (content === undefined) {
        throw new AIProviderError(
          "content_refused",
          "Gemini did not return a structured result for this prompt.",
        );
      }

      return {
        content,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    } catch (error) {
      throw toProviderError(error, module, request.timeoutMs);
    } finally {
      clearTimeout(timer);
    }
  }
}

function toFunctionDeclaration(tool: AIProviderRequest["tool"]): {
  name: string;
  description: string;
  parametersJsonSchema: unknown;
} {
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.inputSchema,
  };
}

function toContents(messages: readonly AIMessage[]): {
  systemInstruction: string | undefined;
  contents: { role: "user"; parts: { text: string }[] }[];
} {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const contents = messages
    .filter((message) => message.role === "user")
    .map((message) => ({ role: "user" as const, parts: [{ text: message.content }] }));

  return {
    systemInstruction: systemInstruction.length > 0 ? systemInstruction : undefined,
    contents,
  };
}

/**
 * Classifies whatever Gemini threw into design D8's canonical conditions,
 * never surfacing the vendor's own error object or message — an `ApiError`
 * message is vendor text this package has not reviewed for what it might
 * echo back (design's redaction guard, task 3.4).
 */
function toProviderError(error: unknown, module: GenAIModule, timeoutMs: number): Error {
  if (error instanceof AIProviderError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AIProviderTimeoutError(timeoutMs);
  }

  if (error instanceof module.ApiError) {
    return new AIProviderError(
      classifyStatus(error.status),
      `Gemini rejected the request (HTTP ${error.status}).`,
    );
  }

  return new AIProviderError("transient", "Gemini request failed before a response was received.");
}

function classifyStatus(status: number): AIProviderConditionType {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "authentication_failed";
  if (status === 400) return "invalid_request";
  if (status >= 500) return "transient";
  return "invalid_request";
}
