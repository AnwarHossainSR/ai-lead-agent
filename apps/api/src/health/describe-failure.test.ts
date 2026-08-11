import { describe, expect, it } from "vitest";

import { CheckTimeoutError } from "./check-timeout";
import { describeFailure } from "./describe-failure";

describe("describeFailure", () => {
  it("reports a timeout as a timeout, with the bound", () => {
    expect(describeFailure("PostgreSQL", new CheckTimeoutError("PostgreSQL", 2_000))).toBe(
      "PostgreSQL did not respond within 2000 ms.",
    );
  });

  it("carries a driver error code through", () => {
    const refused = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5433"), {
      code: "ECONNREFUSED",
    });

    expect(describeFailure("PostgreSQL", refused)).toBe(
      "PostgreSQL is unreachable (ECONNREFUSED).",
    );
  });

  it("finds a code wrapped in a cause chain", () => {
    const inner = Object.assign(new Error("getaddrinfo failed"), { code: "ENOTFOUND" });
    const outer = new Error("query failed", {
      cause: new Error("driver failed", { cause: inner }),
    });

    expect(describeFailure("PostgreSQL", outer)).toBe("PostgreSQL is unreachable (ENOTFOUND).");
  });

  it("says only that the dependency is unreachable when there is no code", () => {
    expect(describeFailure("Redis", new Error("something went wrong"))).toBe(
      "Redis is unreachable.",
    );
  });

  it("never repeats the driver's own message", () => {
    const leaky = new Error('password authentication failed for user "mela"');

    expect(describeFailure("PostgreSQL", leaky)).not.toContain("mela");
    expect(describeFailure("PostgreSQL", leaky)).toBe("PostgreSQL is unreachable.");
  });

  it("refuses a code that does not look like a code", () => {
    // The whole point of the pattern: a connection string assigned to `code`
    // must not become the response body.
    const disguised = Object.assign(new Error("failed"), {
      code: "postgresql://mela:hunter2@localhost:5432/mela",
    });

    expect(describeFailure("PostgreSQL", disguised)).toBe("PostgreSQL is unreachable.");
  });

  it("refuses a code that is too long to be one", () => {
    const disguised = Object.assign(new Error("failed"), { code: "A".repeat(33) });

    expect(describeFailure("PostgreSQL", disguised)).toBe("PostgreSQL is unreachable.");
  });

  it("survives a self-referential cause chain", () => {
    const looping: { cause?: unknown } = {};
    looping.cause = looping;

    expect(describeFailure("Redis", looping)).toBe("Redis is unreachable.");
  });

  it("survives a thrown value that is not an error at all", () => {
    expect(describeFailure("Redis", "boom")).toBe("Redis is unreachable.");
    expect(describeFailure("Redis", null)).toBe("Redis is unreachable.");
    expect(describeFailure("Redis", undefined)).toBe("Redis is unreachable.");
  });
});
