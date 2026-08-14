import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { apiEnvSchema, loadApiEnv } from "./api";
import { databaseEnvSchema, loadDatabaseEnv } from "./database";
import { EnvironmentValidationError } from "./load";
import { SESSION_SECRET_PLACEHOLDER } from "./session-secret";
import { loadWebEnv, webEnvSchema } from "./web";

/**
 * Vitest runs with the package directory as its working directory, so the
 * repository root is two levels up. Reading the real file rather than a
 * fixture is the point: this test exists to catch a schema gaining a variable
 * that nobody documented.
 */
const ENV_EXAMPLE_PATH = resolve(process.cwd(), "..", "..", ".env.example");

function documentedVariables(): Set<string> {
  const contents = readFileSync(ENV_EXAMPLE_PATH, "utf8");
  const names = new Set<string>();

  for (const line of contents.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line.trim());
    if (match?.[1] !== undefined) {
      names.add(match[1]);
    }
  }

  return names;
}

const schemas = [
  { name: "apiEnvSchema", schema: apiEnvSchema },
  { name: "databaseEnvSchema", schema: databaseEnvSchema },
  { name: "webEnvSchema", schema: webEnvSchema },
] as const;

describe(".env.example completeness", () => {
  const documented = documentedVariables();

  it("finds variables in the committed example file", () => {
    expect(documented.size).toBeGreaterThan(0);
  });

  for (const { name, schema } of schemas) {
    it(`documents every variable read by ${name}`, () => {
      const undocumented = Object.keys(schema.shape).filter((key) => !documented.has(key));
      expect(undocumented).toEqual([]);
    });
  }
});

describe("variable descriptions", () => {
  for (const { name, schema } of schemas) {
    it(`gives every variable in ${name} a stated purpose`, () => {
      const missing = Object.entries(schema.shape)
        .filter(([, field]) => (field.description ?? "").trim().length === 0)
        .map(([key]) => key);
      expect(missing).toEqual([]);
    });
  }
});

describe("a missing variable is refused", () => {
  it("names the variable and its purpose", () => {
    let thrown: unknown;
    try {
      loadDatabaseEnv({});
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EnvironmentValidationError);
    const error = thrown as EnvironmentValidationError;

    expect(error.variables).toEqual(["DATABASE_URL"]);
    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).toContain("Purpose: PostgreSQL connection string");
    expect(error.message).toContain("Not set.");
  });

  it("reports every missing variable at once rather than the first", () => {
    expect(() => loadApiEnv({})).toThrow(EnvironmentValidationError);

    try {
      loadApiEnv({});
      expect.unreachable("loadApiEnv should have refused an empty environment");
    } catch (error: unknown) {
      const failure = error as EnvironmentValidationError;
      expect([...failure.variables].sort()).toEqual([
        "CLOUDFLARE_ACCOUNT_ID",
        "CLOUDFLARE_API_TOKEN",
        "DATABASE_URL",
        "GEMINI_API_KEY",
        "QSTASH_TOKEN",
        "REDIS_URL",
        "SESSION_SECRET",
      ]);
    }
  });
});

describe("a malformed variable is refused", () => {
  it("names the expected shape for a connection string", () => {
    try {
      loadDatabaseEnv({ DATABASE_URL: "oracle://localhost:1521/mela" });
      expect.unreachable("loadDatabaseEnv should have refused a non-PostgreSQL URL");
    } catch (error: unknown) {
      const failure = error as EnvironmentValidationError;
      expect(failure.variables).toEqual(["DATABASE_URL"]);
      expect(failure.message).toContain("postgresql://user:password@host:5432/database");
    }
  });

  it("names the expected shape for a port", () => {
    try {
      loadApiEnv({
        API_PORT: "not-a-port",
        DATABASE_URL: "postgresql://mela:pw@localhost:5432/mela",
        REDIS_URL: "redis://localhost:6379",
        GEMINI_API_KEY: "test-gemini-key",
        CLOUDFLARE_ACCOUNT_ID: "test-account-id",
        CLOUDFLARE_API_TOKEN: "test-cf-token",
        QSTASH_TOKEN: "test-qstash-token",
        SESSION_SECRET: "test-session-secret-not-real-0123456789",
      });
      expect.unreachable("loadApiEnv should have refused a non-numeric port");
    } catch (error: unknown) {
      const failure = error as EnvironmentValidationError;
      expect(failure.variables).toEqual(["API_PORT"]);
      expect(failure.message).toContain("Expected a TCP port number between 1 and 65535.");
    }
  });

  it("refuses a port outside the valid range", () => {
    expect(() =>
      loadApiEnv({
        API_PORT: "70000",
        DATABASE_URL: "postgresql://mela:pw@localhost:5432/mela",
        REDIS_URL: "redis://localhost:6379",
        GEMINI_API_KEY: "test-gemini-key",
        CLOUDFLARE_ACCOUNT_ID: "test-account-id",
        CLOUDFLARE_API_TOKEN: "test-cf-token",
        QSTASH_TOKEN: "test-qstash-token",
        SESSION_SECRET: "test-session-secret-not-real-0123456789",
      }),
    ).toThrow(/API_PORT/);
  });

  it("names the expected shape for a malformed spend ceiling", () => {
    try {
      loadApiEnv({
        DATABASE_URL: "postgresql://mela:pw@localhost:5432/mela",
        REDIS_URL: "redis://localhost:6379",
        GEMINI_API_KEY: "test-gemini-key",
        CLOUDFLARE_ACCOUNT_ID: "test-account-id",
        CLOUDFLARE_API_TOKEN: "test-cf-token",
        QSTASH_TOKEN: "test-qstash-token",
        SESSION_SECRET: "test-session-secret-not-real-0123456789",
        AI_SPEND_CEILING_USD: "not-a-number",
      });
      expect.unreachable("loadApiEnv should have refused a non-numeric spend ceiling");
    } catch (error: unknown) {
      const failure = error as EnvironmentValidationError;
      expect(failure.variables).toEqual(["AI_SPEND_CEILING_USD"]);
      expect(failure.message).toContain("Expected a positive number");
    }
  });
});

describe("metrics port equal to application port aborts startup", () => {
  const validApiEnv = {
    DATABASE_URL: "postgresql://mela:pw@localhost:5432/mela",
    REDIS_URL: "redis://localhost:6379",
    GEMINI_API_KEY: "test-gemini-key",
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    CLOUDFLARE_API_TOKEN: "test-cf-token",
    QSTASH_TOKEN: "test-qstash-token",
    SESSION_SECRET: "test-session-secret-not-real-0123456789",
  };

  it("names both ports when they match", () => {
    try {
      loadApiEnv({ ...validApiEnv, API_PORT: "4000", METRICS_PORT: "4000" });
      expect.unreachable("loadApiEnv should have refused identical ports");
    } catch (error: unknown) {
      const failure = error as EnvironmentValidationError;
      expect(failure.variables).toContain("METRICS_PORT");
      expect(failure.message).toContain("API_PORT");
      expect(failure.message).toContain("4000");
    }
  });

  it("accepts different ports", () => {
    const env = loadApiEnv({ ...validApiEnv, API_PORT: "3001", METRICS_PORT: "9090" });
    expect(env.API_PORT).toBe(3001);
    expect(env.METRICS_PORT).toBe(9090);
  });
});

describe("failure messages carry no credential", () => {
  it("does not repeat the rejected value", () => {
    const password = "hunter2-should-never-be-printed";

    try {
      loadApiEnv({
        DATABASE_URL: "postgresql://mela:pw@localhost:5432/mela",
        REDIS_URL: `http://mela:${password}@localhost:6379`,
        GEMINI_API_KEY: "test-gemini-key",
        CLOUDFLARE_ACCOUNT_ID: "test-account-id",
        CLOUDFLARE_API_TOKEN: "test-cf-token",
        QSTASH_TOKEN: "test-qstash-token",
        SESSION_SECRET: "test-session-secret-not-real-0123456789",
      });
      expect.unreachable("loadApiEnv should have refused a non-Redis URL");
    } catch (error: unknown) {
      const failure = error as EnvironmentValidationError;
      expect(failure.message).toContain("REDIS_URL");
      expect(failure.message).not.toContain(password);
    }
  });
});

describe("a valid environment is accepted", () => {
  const validApiEnv = {
    DATABASE_URL: "postgresql://mela:pw@localhost:5432/mela",
    REDIS_URL: "redis://localhost:6379",
    GEMINI_API_KEY: "test-gemini-key",
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    CLOUDFLARE_API_TOKEN: "test-cf-token",
    QSTASH_TOKEN: "test-qstash-token",
    SESSION_SECRET: "test-session-secret-not-real-0123456789",
  };

  it("applies the documented defaults", () => {
    const env = loadApiEnv(validApiEnv);

    expect(env.NODE_ENV).toBe("development");
    expect(env.API_PORT).toBe(3001);
    expect(env.METRICS_PORT).toBe(9090);
    expect(env.LOG_LEVEL).toBe("log");
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
    expect(env.AI_MODEL_DEFAULT).toBe("gemini-2.5-pro");
    expect(env.AI_MODEL_FAST).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(env.AI_MAX_OUTPUT_TOKENS).toBe(4_096);
    expect(env.AI_TIMEOUT_MS).toBe(60_000);
    expect(env.AI_SPEND_CEILING_USD).toBe(20);
    expect(env.AI_SPEND_WINDOW_HOURS).toBe(24);
  });

  it("parses a port into a number", () => {
    const env = loadApiEnv({ ...validApiEnv, API_PORT: "4000" });
    expect(env.API_PORT).toBe(4000);
  });

  it("returns a frozen result", () => {
    const env = loadApiEnv(validApiEnv);
    expect(Object.isFrozen(env)).toBe(true);
  });

  it("ignores variables it was not asked about", () => {
    const env = loadWebEnv({
      NEXT_PUBLIC_API_URL: "http://localhost:3001",
      API_URL: "http://localhost:3001",
      UNRELATED_SECRET: "should-not-appear",
    });

    expect(Object.keys(env).sort()).toEqual(["API_URL", "NEXT_PUBLIC_API_URL"]);
  });
});

describe("the session secret startup guard", () => {
  const baseEnv = {
    DATABASE_URL: "postgresql://mela:pw@localhost:5432/mela",
    REDIS_URL: "redis://localhost:6379",
    GEMINI_API_KEY: "test-gemini-key",
    CLOUDFLARE_ACCOUNT_ID: "test-account-id",
    CLOUDFLARE_API_TOKEN: "test-cf-token",
    QSTASH_TOKEN: "test-qstash-token",
  };

  it("aborts naming the variable when the secret is missing", () => {
    try {
      loadApiEnv(baseEnv);
      expect.unreachable("loadApiEnv should have refused a missing SESSION_SECRET");
    } catch (error: unknown) {
      const failure = error as EnvironmentValidationError;
      expect(failure.variables).toContain("SESSION_SECRET");
      expect(failure.message).toContain("SESSION_SECRET");
    }
  });

  it("accepts the committed placeholder in development", () => {
    const env = loadApiEnv({ ...baseEnv, SESSION_SECRET: SESSION_SECRET_PLACEHOLDER });
    expect(env.SESSION_SECRET).toBe(SESSION_SECRET_PLACEHOLDER);
  });

  it("refuses the committed placeholder outside development", () => {
    expect(() =>
      loadApiEnv({
        ...baseEnv,
        NODE_ENV: "production",
        SESSION_SECRET: SESSION_SECRET_PLACEHOLDER,
      }),
    ).toThrow(/placeholder may not be used outside development/);
  });

  it("refuses a short secret outside development", () => {
    expect(() =>
      loadApiEnv({ ...baseEnv, NODE_ENV: "production", SESSION_SECRET: "too-short" }),
    ).toThrow(/at least 32 characters/);
  });

  it("accepts a short secret in development", () => {
    const env = loadApiEnv({ ...baseEnv, SESSION_SECRET: "short-but-fine-for-dev" });
    expect(env.SESSION_SECRET).toBe("short-but-fine-for-dev");
  });

  it("accepts a long, non-placeholder secret outside development", () => {
    const env = loadApiEnv({
      ...baseEnv,
      NODE_ENV: "production",
      SESSION_SECRET: "a-real-32-character-or-longer-secret-value",
    });
    expect(env.SESSION_SECRET).toBe("a-real-32-character-or-longer-secret-value");
  });

  it("never lets a recognisable short secret reach the failure message", () => {
    const secret = "recognisable-value";
    try {
      loadApiEnv({ ...baseEnv, NODE_ENV: "production", SESSION_SECRET: secret });
      expect.unreachable("loadApiEnv should have refused a secret shorter than the minimum");
    } catch (error: unknown) {
      const failure = error as EnvironmentValidationError;
      expect(failure.message).not.toContain(secret);
    }
  });
});
