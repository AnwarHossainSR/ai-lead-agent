import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { aiInvocations } from "../schema/ai-invocations";
import { aiInvocationInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertAIInvocation, spendInWindow } from "./ai-invocations";
import { WriteValidationError } from "./errors";

let harness: TestDatabase;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
});

afterAll(async () => {
  await harness.close();
});

describe("a model call", () => {
  it("is stored with its accounting", async () => {
    const row = await insertAIInvocation(
      harness.database,
      aiInvocationInput({
        promptName: "opportunity_analysis",
        promptVersion: 2,
        model: "gemini-2.5-pro",
        tier: "default",
        inputTokens: 1_200,
        outputTokens: 340,
        estimatedCostUsd: 0.0051,
        latencyMs: 4_800,
        attempts: 1,
        outcome: "succeeded",
      }),
    );

    expect(row.promptName).toBe("opportunity_analysis");
    expect(row.promptVersion).toBe(2);
    expect(row.model).toBe("gemini-2.5-pro");
    expect(row.tier).toBe("default");
    expect(row.inputTokens).toBe(1_200);
    expect(row.outputTokens).toBe(340);
    expect(row.estimatedCostUsd).toBeCloseTo(0.0051, 6);
    expect(row.latencyMs).toBe(4_800);
    expect(row.outcome).toBe("succeeded");
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("carries no credential and no prompt or response text — there are no columns for them", async () => {
    const row = await insertAIInvocation(harness.database, aiInvocationInput());

    const forbidden = ["apiKey", "api_key", "prompt", "promptText", "response", "responseText"];
    for (const key of forbidden) {
      expect(Object.keys(row)).not.toContain(key);
    }
  });

  it("records a failed call with a failure code", async () => {
    const row = await insertAIInvocation(
      harness.database,
      aiInvocationInput({ outcome: "invalid_output", failureCode: "SCHEMA_MISMATCH" }),
    );

    expect(row.outcome).toBe("invalid_output");
    expect(row.failureCode).toBe("SCHEMA_MISMATCH");
  });
});

describe("an unrecognised outcome", () => {
  it("is refused by the write helper before it reaches the database", async () => {
    await expect(
      insertAIInvocation(
        harness.database,
        // @ts-expect-error — deliberately outside the declared union
        aiInvocationInput({ outcome: "cancelled" }),
      ),
    ).rejects.toThrow(WriteValidationError);
  });

  it("is refused by the database itself when the write helper is bypassed", async () => {
    let thrown: unknown;

    try {
      await harness.database.execute(
        sql`insert into ${aiInvocations} (id, prompt_name, prompt_version, model, tier, input_tokens, output_tokens, estimated_cost_usd, latency_ms, attempts, outcome)
            values (gen_random_uuid(), 'p', 1, 'm', 'default', 1, 1, 0, 1, 1, 'bogus_outcome')`,
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
  });
});

describe("spendInWindow", () => {
  it("is zero when nothing has been recorded", async () => {
    expect(await spendInWindow(harness.database, 24)).toBe(0);
  });

  it("sums recorded cost within the window", async () => {
    await insertAIInvocation(harness.database, aiInvocationInput({ estimatedCostUsd: 0.01 }));
    await insertAIInvocation(harness.database, aiInvocationInput({ estimatedCostUsd: 0.02 }));

    expect(await spendInWindow(harness.database, 24)).toBeCloseTo(0.03, 6);
  });

  it("excludes calls recorded outside the window", async () => {
    await insertAIInvocation(harness.database, aiInvocationInput({ estimatedCostUsd: 0.5 }));

    await harness.database.execute(
      sql`update ${aiInvocations} set created_at = now() - interval '48 hours'`,
    );

    expect(await spendInWindow(harness.database, 24)).toBe(0);
  });
});
