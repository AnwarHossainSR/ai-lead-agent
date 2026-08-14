import { describe, expect, it } from "vitest";

import { SESSION_COOKIE_NAME, sessionCookieAttributes } from "./session-cookie";

describe("sessionCookieAttributes", () => {
  it("is always HTTP-only and same-site restricted", () => {
    for (const nodeEnv of ["development", "test", "production"]) {
      const attributes = sessionCookieAttributes(nodeEnv);
      expect(attributes.httpOnly).toBe(true);
      expect(attributes.sameSite).toBe("lax");
      expect(attributes.path).toBe("/");
    }
  });

  it("is not marked secure in development", () => {
    expect(sessionCookieAttributes("development").secure).toBe(false);
  });

  it("is marked secure outside development", () => {
    expect(sessionCookieAttributes("test").secure).toBe(true);
    expect(sessionCookieAttributes("production").secure).toBe(true);
  });
});

describe("SESSION_COOKIE_NAME", () => {
  it("is a non-blank name", () => {
    expect(SESSION_COOKIE_NAME.trim().length).toBeGreaterThan(0);
  });
});
