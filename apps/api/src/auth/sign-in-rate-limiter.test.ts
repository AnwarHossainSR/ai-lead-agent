import { describe, expect, it } from "vitest";

import { SignInRateLimiter } from "./sign-in-rate-limiter";

describe("SignInRateLimiter", () => {
  it("permits attempts up to the per-account limit, then refuses", () => {
    const limiter = new SignInRateLimiter(60_000, 3, 100);

    expect(limiter.registerAttempt("a@example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt("a@example.com", "1.1.1.2")).toBe(true);
    expect(limiter.registerAttempt("a@example.com", "1.1.1.3")).toBe(true);
    expect(limiter.registerAttempt("a@example.com", "1.1.1.4")).toBe(false);
  });

  it("permits attempts up to the per-source limit, then refuses", () => {
    const limiter = new SignInRateLimiter(60_000, 100, 2);

    expect(limiter.registerAttempt("a@example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt("b@example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt("c@example.com", "1.1.1.1")).toBe(false);
  });

  it("throttles an unknown address exactly like a known one", () => {
    const limiter = new SignInRateLimiter(60_000, 1, 100);

    expect(limiter.registerAttempt("unknown@example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt("unknown@example.com", "1.1.1.2")).toBe(false);
  });

  it("does not block a different account after one is throttled", () => {
    const limiter = new SignInRateLimiter(60_000, 1, 100);

    expect(limiter.registerAttempt("throttled@example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt("throttled@example.com", "1.1.1.2")).toBe(false);
    expect(limiter.registerAttempt("other@example.com", "1.1.1.3")).toBe(true);
  });

  it("is case-insensitive and trims the email when keying the account bucket", () => {
    const limiter = new SignInRateLimiter(60_000, 1, 100);

    expect(limiter.registerAttempt("Same@Example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt(" same@example.com ", "1.1.1.2")).toBe(false);
  });

  it("resets once the window passes", () => {
    let now = 0;
    const limiter = new SignInRateLimiter(1_000, 1, 100, () => now);

    expect(limiter.registerAttempt("a@example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt("a@example.com", "1.1.1.1")).toBe(false);

    now = 1_001;
    expect(limiter.registerAttempt("a@example.com", "1.1.1.1")).toBe(true);
  });

  it("clears an account's bucket on reset, without affecting other accounts", () => {
    const limiter = new SignInRateLimiter(60_000, 1, 100);

    expect(limiter.registerAttempt("a@example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt("b@example.com", "2.2.2.2")).toBe(true);

    limiter.reset("a@example.com");

    expect(limiter.registerAttempt("a@example.com", "1.1.1.1")).toBe(true);
    expect(limiter.registerAttempt("b@example.com", "2.2.2.2")).toBe(false);
  });
});
