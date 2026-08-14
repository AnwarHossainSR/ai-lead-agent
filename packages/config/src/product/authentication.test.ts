import { describe, expect, it } from "vitest";

import { AUTHENTICATION_CONFIG, parseAuthenticationConfig } from "./authentication";

describe("AUTHENTICATION_CONFIG", () => {
  it("defines a sliding lifetime no greater than the absolute maximum", () => {
    expect(AUTHENTICATION_CONFIG.sessionLifetimeMinutes).toBeLessThanOrEqual(
      AUTHENTICATION_CONFIG.sessionAbsoluteMaxLifetimeMinutes,
    );
  });

  it("defines Argon2id parameters at or above the OWASP minimum", () => {
    expect(AUTHENTICATION_CONFIG.argon2.memoryCostKib).toBeGreaterThanOrEqual(19 * 1024);
    expect(AUTHENTICATION_CONFIG.argon2.timeCost).toBeGreaterThanOrEqual(2);
    expect(AUTHENTICATION_CONFIG.argon2.parallelism).toBeGreaterThanOrEqual(1);
  });

  it("defines a positive rate limit window and thresholds", () => {
    expect(AUTHENTICATION_CONFIG.rateLimit.windowMinutes).toBeGreaterThan(0);
    expect(AUTHENTICATION_CONFIG.rateLimit.maxAttemptsPerAccount).toBeGreaterThan(0);
    expect(AUTHENTICATION_CONFIG.rateLimit.maxAttemptsPerSource).toBeGreaterThan(0);
  });

  it("defines a minimum password length", () => {
    expect(AUTHENTICATION_CONFIG.minimumPasswordLength).toBeGreaterThanOrEqual(8);
  });
});

describe("parseAuthenticationConfig", () => {
  it("parses a well-formed config", () => {
    const config = parseAuthenticationConfig({
      sessionLifetimeMinutes: 60,
      sessionAbsoluteMaxLifetimeMinutes: 120,
      argon2: { memoryCostKib: 19456, timeCost: 2, parallelism: 1 },
      rateLimit: { windowMinutes: 15, maxAttemptsPerAccount: 5, maxAttemptsPerSource: 20 },
      minimumPasswordLength: 12,
    });

    expect(config.sessionLifetimeMinutes).toBe(60);
  });

  it("refuses an absolute maximum shorter than the sliding lifetime", () => {
    expect(() =>
      parseAuthenticationConfig({
        sessionLifetimeMinutes: 120,
        sessionAbsoluteMaxLifetimeMinutes: 60,
        argon2: { memoryCostKib: 19456, timeCost: 2, parallelism: 1 },
        rateLimit: { windowMinutes: 15, maxAttemptsPerAccount: 5, maxAttemptsPerSource: 20 },
        minimumPasswordLength: 12,
      }),
    ).toThrow(/sessionAbsoluteMaxLifetimeMinutes must be at least sessionLifetimeMinutes/);
  });

  it("refuses a non-positive minimum password length", () => {
    expect(() =>
      parseAuthenticationConfig({
        sessionLifetimeMinutes: 60,
        sessionAbsoluteMaxLifetimeMinutes: 120,
        argon2: { memoryCostKib: 19456, timeCost: 2, parallelism: 1 },
        rateLimit: { windowMinutes: 15, maxAttemptsPerAccount: 5, maxAttemptsPerSource: 20 },
        minimumPasswordLength: 0,
      }),
    ).toThrow();
  });
});
