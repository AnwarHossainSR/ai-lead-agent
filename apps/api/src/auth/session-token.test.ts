import { describe, expect, it } from "vitest";

import { generateSessionToken, hashSessionToken } from "./session-token";

describe("generateSessionToken", () => {
  it("produces a high-entropy, URL-safe token", () => {
    const token = generateSessionToken();

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSessionToken()));

    expect(tokens.size).toBe(100);
  });
});

describe("hashSessionToken", () => {
  it("is deterministic for the same secret and token", () => {
    expect(hashSessionToken("secret", "token")).toBe(hashSessionToken("secret", "token"));
  });

  it("differs when the token differs", () => {
    expect(hashSessionToken("secret", "token-a")).not.toBe(hashSessionToken("secret", "token-b"));
  });

  it("differs when the secret differs", () => {
    expect(hashSessionToken("secret-a", "token")).not.toBe(hashSessionToken("secret-b", "token"));
  });

  it("never contains the raw token", () => {
    const token = "a-recognisable-raw-token-value";

    expect(hashSessionToken("secret", token)).not.toContain(token);
  });
});
