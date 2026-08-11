import { AIProviderError, AIProviderTimeoutError, type AIProviderConditionType } from "./errors";
import type { AIProvider, AIProviderRequest, AIProviderResponse } from "./provider";
import { withRetry } from "./retry";

interface CloudflareToolCall {
  readonly name: string;
  readonly arguments: unknown;
}

interface CloudflareUsage {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
}

interface CloudflareResult {
  readonly tool_calls?: readonly CloudflareToolCall[];
  readonly usage?: CloudflareUsage;
}

interface CloudflareResponseBody {
  readonly success: boolean;
  readonly result?: CloudflareResult;
}

export interface CloudflareCredentials {
  readonly accountId: string;
  readonly apiToken: string;
}

/**
 * The fast tier's transport (design D3). No SDK: Workers AI is one REST
 * endpoint, called with `fetch`, in the same OpenAI-compatible tool-calling
 * shape the catalog documents for instruction-tuned models.
 */
export class CloudflareProvider implements AIProvider {
  private readonly credentials: CloudflareCredentials;

  constructor(credentials: CloudflareCredentials) {
    this.credentials = credentials;
  }

  async request(request: AIProviderRequest): Promise<AIProviderResponse> {
    return withRetry(() => this.attempt(request));
  }

  private async attempt(request: AIProviderRequest): Promise<AIProviderResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.credentials.accountId}/ai/run/${request.model}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.credentials.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          tools: [
            {
              type: "function",
              function: {
                name: request.tool.name,
                description: request.tool.description,
                parameters: request.tool.inputSchema,
              },
            },
          ],
          max_tokens: request.maxOutputTokens,
        }),
      });

      if (!response.ok) {
        throw new AIProviderError(
          classifyStatus(response.status),
          `Cloudflare Workers AI rejected the request (HTTP ${response.status}).`,
          retryAfterMs(response),
        );
      }

      const body = (await response.json()) as CloudflareResponseBody;

      if (!body.success) {
        throw new AIProviderError(
          "invalid_request",
          "Cloudflare Workers AI reported the request as unsuccessful.",
        );
      }

      const toolCall = body.result?.tool_calls?.[0];

      if (toolCall === undefined) {
        throw new AIProviderError(
          "content_refused",
          "Cloudflare Workers AI did not return a structured result for this prompt.",
        );
      }

      return {
        content: toolCall.arguments,
        usage: {
          inputTokens: body.result?.usage?.prompt_tokens ?? 0,
          outputTokens: body.result?.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      throw toProviderError(error, request.timeoutMs);
    } finally {
      clearTimeout(timer);
    }
  }
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (header === null) {
    return null;
  }

  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : null;
}

function classifyStatus(status: number): AIProviderConditionType {
  if (status === 429) return "rate_limited";
  if (status === 401 || status === 403) return "authentication_failed";
  if (status === 400) return "invalid_request";
  if (status >= 500) return "transient";
  return "invalid_request";
}

/**
 * Never surfaces the fetch error's own message — it can carry request
 * details this package has not reviewed for what they might echo back
 * (design's redaction guard, task 3.4).
 */
function toProviderError(error: unknown, timeoutMs: number): Error {
  if (error instanceof AIProviderError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AIProviderTimeoutError(timeoutMs);
  }

  return new AIProviderError(
    "transient",
    "Cloudflare Workers AI request failed before a response was received.",
  );
}
