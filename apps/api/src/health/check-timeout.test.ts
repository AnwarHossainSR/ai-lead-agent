import { describe, expect, it } from "vitest";

import { CHECK_TIMEOUT_MS, CheckTimeoutError, withCheckTimeout } from "./check-timeout";

/** A promise that never settles — the case the timeout exists for. */
function hangs<T>(): Promise<T> {
  return new Promise<T>(() => {
    // Deliberately never resolved: this stands in for a dependency that
    // accepts the connection and then says nothing.
  });
}

describe("withCheckTimeout", () => {
  it("resolves with the work when it finishes in time", async () => {
    await expect(withCheckTimeout("PostgreSQL", Promise.resolve("pong"), 50)).resolves.toBe("pong");
  });

  it("rejects with the work's own error when the work fails in time", async () => {
    const failure = new Error("connection refused");

    await expect(withCheckTimeout("Redis", Promise.reject(failure), 50)).rejects.toBe(failure);
  });

  it("rejects once the timeout passes when the work never settles", async () => {
    const started = Date.now();

    await expect(withCheckTimeout("Redis", hangs(), 50)).rejects.toBeInstanceOf(CheckTimeoutError);

    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it("names the dependency and the bound it exceeded", async () => {
    const error = await withCheckTimeout("PostgreSQL", hangs(), 25).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CheckTimeoutError);
    expect((error as CheckTimeoutError).dependency).toBe("PostgreSQL");
    expect((error as CheckTimeoutError).timeoutMs).toBe(25);
    expect((error as CheckTimeoutError).message).toBe("PostgreSQL did not respond within 25 ms.");
  });

  it("defaults to the two-second bound the design specifies", async () => {
    expect(CHECK_TIMEOUT_MS).toBe(2_000);

    const started = Date.now();
    await expect(withCheckTimeout("PostgreSQL", hangs())).rejects.toBeInstanceOf(CheckTimeoutError);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeGreaterThanOrEqual(2_000);
    expect(elapsed).toBeLessThan(4_000);
  });

  it("does not leave a pending timer behind when the work wins", async () => {
    // A timer left armed keeps the event loop alive, which is how a test suite
    // ends up hanging for two seconds after its last assertion.
    const before = process.getActiveResourcesInfo().filter((kind) => kind === "Timeout").length;

    await withCheckTimeout("Redis", Promise.resolve("pong"), 5_000);

    const after = process.getActiveResourcesInfo().filter((kind) => kind === "Timeout").length;
    expect(after).toBe(before);
  });
});
