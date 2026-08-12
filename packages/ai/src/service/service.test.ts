import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { testClassifyOutputSchema } from "../prompts/test-classify/v1";
import { FakeAIProvider } from "../testing/fake-provider";
import { AIService, type AIServiceConfig, SpendCeilingError } from "./ai.service";
import { estimateCost, modelForTier } from "./spend";
import { OutputValidationError, failingFields, parseOutput } from "./validate";

// Import to register the test prompt
import "../prompts/test-classify/v1";

// ---------------------------------------------------------------------------
// Mock database
// ---------------------------------------------------------------------------

function createMockExecutor() {
  const invocations: Array<Record<string, unknown>> = [];
  let spendResult = 0;

  const executor = {
    insert: vi.fn(() => ({
      values: vi.fn((value: Record<string, unknown>) => {
        invocations.push(value);
        return {
          returning: vi.fn(() => Promise.resolve([{ id: `inv-${invocations.length}` }])),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([{ total: String(spendResult) }])),
      })),
    })),
  };

  return {
    executor: executor as never,
    invocations,
    setSpendResult(total: number) {
      spendResult = total;
    },
  };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AIServiceConfig = {
  maxOutputTokens: 4096,
  timeoutMs: 60_000,
  spendCeilingUsd: 20,
  spendWindowHours: 24,
};

// ---------------------------------------------------------------------------
// Cost estimation (design D6)
// ---------------------------------------------------------------------------

describe("cost estimation", () => {
  it("computes cost from token counts and tier prices", () => {
    // fast tier: input $0.29/M, output $2.25/M
    const cost = estimateCost("fast", {
      inputTokens: 1_000,
      outputTokens: 500,
    });

    // input: 1000/1M * 0.29 = 0.00029
    // output: 500/1M * 2.25 = 0.001125
    // total: 0.001415
    expect(cost.estimatedCostUsd).toBeCloseTo(0.001415, 6);
    expect(cost.inputTokens).toBe(1_000);
    expect(cost.outputTokens).toBe(500);
  });

  it("returns the model identifier for a tier", () => {
    expect(modelForTier("fast")).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(modelForTier("default")).toBe("gemini-2.5-pro");
  });
});

// ---------------------------------------------------------------------------
// Output validation (design D4)
// ---------------------------------------------------------------------------

describe("output validation", () => {
  it("parses valid output successfully", () => {
    const result = parseOutput(testClassifyOutputSchema, {
      classification: "needs_website",
      confidence: 0.9,
      reasoning: "The company has no website",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.classification).toBe("needs_website");
    }
  });

  it("returns a ZodError for invalid output", () => {
    const result = parseOutput(testClassifyOutputSchema, {
      classification: "invalid_value",
      confidence: 0.9,
      reasoning: "test",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("extracts failing field paths", () => {
    const result = parseOutput(testClassifyOutputSchema, {
      classification: "invalid_value",
      confidence: 1.5,
      reasoning: 123,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const fields = failingFields(result.error);
      expect(fields).toContain("classification");
      expect(fields).toContain("confidence");
    }
  });

  it("OutputValidationError carries prompt name, version, and fields", () => {
    const error = new z.ZodError([
      {
        code: "invalid_type",
        expected: "string",
        path: ["reasoning"],
        message: "Expected string, received number",
      },
    ]);

    const outputError = new OutputValidationError("test-classify", 1, ["reasoning"], error);

    expect(outputError.promptName).toBe("test-classify");
    expect(outputError.promptVersion).toBe(1);
    expect(outputError.fields).toEqual(["reasoning"]);
    expect(outputError.message).toContain("test-classify");
    expect(outputError.message).toContain("v1");
  });
});

// ---------------------------------------------------------------------------
// AIService scenarios (design D9)
// ---------------------------------------------------------------------------

describe("AIService", () => {
  let fakeProvider: FakeAIProvider;
  let mock: ReturnType<typeof createMockExecutor>;
  let service: AIService;

  beforeEach(() => {
    fakeProvider = new FakeAIProvider();
    mock = createMockExecutor();
    service = new AIService(fakeProvider, mock.executor, DEFAULT_CONFIG);
  });

  describe("successful call", () => {
    it("returns parsed output and records invocation", async () => {
      fakeProvider.enqueue({
        kind: "valid",
        content: {
          classification: "needs_website",
          confidence: 0.85,
          reasoning: "The company description suggests no web presence",
        },
      });

      const result = await service.run("test-classify", 1, {
        input: "Acme Corp, Dubai — provides logistics services",
      });

      expect(result.value).toEqual({
        classification: "needs_website",
        confidence: 0.85,
        reasoning: "The company description suggests no web presence",
      });
      expect(result.invocationId).toBe("inv-1");
      expect(mock.invocations).toHaveLength(1);
      expect(mock.invocations[0]!.outcome).toBe("succeeded");
    });
  });

  describe("invalid output — repair then succeed", () => {
    it("repairs once and succeeds on second attempt", async () => {
      fakeProvider.enqueue({ kind: "invalid_output", content: { classification: "bad" } }).enqueue({
        kind: "valid",
        content: {
          classification: "no_need",
          confidence: 0.7,
          reasoning: "Already has a modern site",
        },
      });

      const result = await service.run("test-classify", 1, {
        input: "Example Corp, Abu Dhabi — consulting",
      });

      expect((result.value as { classification: string }).classification).toBe("no_need");
      expect(mock.invocations).toHaveLength(1);
      expect(mock.invocations[0]!.outcome).toBe("succeeded");
      expect(mock.invocations[0]!.attempts).toBe(2);
    });
  });

  describe("invalid output — fails twice", () => {
    it("throws OutputValidationError after two failures", async () => {
      fakeProvider
        .enqueue({ kind: "invalid_output", content: { bad: true } })
        .enqueue({ kind: "invalid_output", content: { still: "bad" } });

      await expect(service.run("test-classify", 1, { input: "test" })).rejects.toThrow(
        OutputValidationError,
      );

      expect(mock.invocations).toHaveLength(1);
      expect(mock.invocations[0]!.outcome).toBe("invalid_output");
    });
  });

  describe("provider error", () => {
    it("records provider_error and rethrows", async () => {
      fakeProvider.enqueue({ kind: "authentication_failed" });

      await expect(service.run("test-classify", 1, { input: "test" })).rejects.toThrow();

      expect(mock.invocations).toHaveLength(1);
      expect(mock.invocations[0]!.outcome).toBe("provider_error");
      expect(mock.invocations[0]!.failureCode).toBe("authentication_failed");
    });
  });

  describe("spend ceiling", () => {
    it("refuses when ceiling is reached", async () => {
      mock.setSpendResult(25); // above the $20 ceiling

      await expect(service.run("test-classify", 1, { input: "test" })).rejects.toThrow(
        SpendCeilingError,
      );

      // The refusal is recorded
      expect(mock.invocations).toHaveLength(1);
      expect(mock.invocations[0]!.outcome).toBe("refused_by_ceiling");
      expect(mock.invocations[0]!.failureCode).toBe("spend_ceiling_reached");

      // No provider call was made
      expect(fakeProvider.calls).toHaveLength(0);
    });

    it("proceeds when below ceiling", async () => {
      mock.setSpendResult(5); // below the $20 ceiling
      fakeProvider.enqueue({
        kind: "valid",
        content: {
          classification: "insufficient_evidence",
          confidence: 0.1,
          reasoning: "Not enough information",
        },
      });

      const result = await service.run("test-classify", 1, {
        input: "Mystery Corp",
      });

      expect((result.value as { classification: string }).classification).toBe(
        "insufficient_evidence",
      );
      expect(fakeProvider.calls).toHaveLength(1);
    });
  });

  describe("insufficient evidence as valid result", () => {
    it("returns the model's refusal as a valid parsed result", async () => {
      fakeProvider.enqueue({
        kind: "valid",
        content: {
          classification: "insufficient_evidence",
          confidence: 0.1,
          reasoning: "The text contains no information about web presence",
        },
      });

      const result = await service.run("test-classify", 1, {
        input: "???",
      });

      expect((result.value as { classification: string }).classification).toBe(
        "insufficient_evidence",
      );
      expect(mock.invocations[0]!.outcome).toBe("succeeded");
    });
  });

  describe("unregistered prompt", () => {
    it("throws before calling the provider", async () => {
      await expect(service.run("nonexistent", 1, { input: "test" })).rejects.toThrow(/nonexistent/);

      expect(fakeProvider.calls).toHaveLength(0);
      expect(mock.invocations).toHaveLength(0);
    });
  });

  describe("unregistered version", () => {
    it("throws naming existing versions", async () => {
      await expect(service.run("test-classify", 99, { input: "test" })).rejects.toThrow(
        /version 99/,
      );

      expect(fakeProvider.calls).toHaveLength(0);
    });
  });

  describe("rate limit is retried by transport", () => {
    it("retries and succeeds after rate limit", async () => {
      fakeProvider.enqueue(
        { kind: "rate_limited" },
        {
          kind: "valid",
          content: {
            classification: "no_need",
            confidence: 0.6,
            reasoning: "Has a website",
          },
        },
      );

      const result = await service.run("test-classify", 1, {
        input: "Tech Corp, Riyadh",
      });

      expect((result.value as { classification: string }).classification).toBe("no_need");
      // The rate limit is retried by withRetry — only one invocation record
      expect(mock.invocations).toHaveLength(1);
      expect(mock.invocations[0]!.outcome).toBe("succeeded");
    });
  });

  describe("tool definition uses JSON Schema from output schema", () => {
    it("passes a JSON Schema tool definition to the provider", async () => {
      fakeProvider.enqueue({
        kind: "valid",
        content: {
          classification: "needs_website",
          confidence: 0.9,
          reasoning: "No website",
        },
      });

      await service.run("test-classify", 1, { input: "test" });

      const call = fakeProvider.calls[0]!;
      expect(call.tool.name).toBe("classify_result");
      expect(call.tool.inputSchema).toHaveProperty(
        "$schema",
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(call.tool.inputSchema).toHaveProperty("type", "object");
    });
  });
});
