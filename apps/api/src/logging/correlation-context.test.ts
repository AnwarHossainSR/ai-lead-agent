import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getCorrelationId, getProcessRole, runWithCorrelation } from "./correlation-context";

describe("correlation context", () => {
  it("provides the correlation ID inside the context", () => {
    const id = randomUUID();
    runWithCorrelation({ correlationId: id, role: "api" }, () => {
      expect(getCorrelationId()).toBe(id);
    });
  });

  it("provides the process role inside the context", () => {
    const id = randomUUID();
    runWithCorrelation({ correlationId: id, role: "worker" }, () => {
      expect(getProcessRole()).toBe("worker");
    });
  });

  it("returns undefined outside any context", () => {
    expect(getCorrelationId()).toBeUndefined();
    expect(getProcessRole()).toBeUndefined();
  });

  it("shares the same ID across nested async calls", async () => {
    const id = randomUUID();
    await runWithCorrelation({ correlationId: id, role: "api" }, async () => {
      expect(getCorrelationId()).toBe(id);
      await Promise.resolve();
      expect(getCorrelationId()).toBe(id);
    });
  });

  it("returns the callback result", () => {
    const result = runWithCorrelation({ correlationId: "test-id", role: "api" }, () => 42);
    expect(result).toBe(42);
  });

  it("isolates concurrent contexts", async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();

    const results = await Promise.all([
      runWithCorrelation({ correlationId: id1, role: "api" }, async () => {
        await Promise.resolve();
        return getCorrelationId();
      }),
      runWithCorrelation({ correlationId: id2, role: "worker" }, async () => {
        await Promise.resolve();
        return getCorrelationId();
      }),
    ]);

    expect(results).toEqual([id1, id2]);
  });
});
