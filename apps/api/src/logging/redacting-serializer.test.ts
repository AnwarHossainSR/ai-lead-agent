import { describe, expect, it } from "vitest";

import { redact } from "./redacting-serializer";

const SECRETS = ["super-secret-api-key-abc123"];

describe("redact", () => {
  describe("connection strings", () => {
    it("redacts postgres:// URLs", () => {
      const result = redact({ url: "postgres://admin:pw@db:5432/prod" }, SECRETS);
      expect(result).toEqual({ url: "<redacted:connection-string>" });
    });

    it("redacts postgresql:// URLs", () => {
      const result = redact({ url: "postgresql://user:pass@host:5432/db" }, SECRETS);
      expect(result).toEqual({ url: "<redacted:connection-string>" });
    });

    it("redacts redis:// URLs", () => {
      const result = redact({ url: "redis://localhost:6379" }, []);
      expect(result).toEqual({ url: "<redacted:connection-string>" });
    });

    it("redacts rediss:// URLs", () => {
      const result = redact({ url: "rediss://default:token@host:6379" }, []);
      expect(result).toEqual({ url: "<redacted:connection-string>" });
    });

    it("redacts connection strings embedded in larger text", () => {
      const result = redact(
        { msg: "Failed to connect to postgres://user:pass@host:5432/db" },
        SECRETS,
      );
      expect(result).toEqual({ msg: "Failed to connect to <redacted:connection-string>" });
    });
  });

  describe("API keys and credentials", () => {
    it("redacts known secret values by exact match", () => {
      const result = redact({ key: "super-secret-api-key-abc123" }, SECRETS);
      expect(result).toEqual({ key: "<redacted:credential>" });
    });

    it("redacts a secret embedded in a larger string", () => {
      const result = redact({ msg: "Key super-secret-api-key-abc123 was rejected" }, SECRETS);
      expect(result).toEqual({ msg: "Key <redacted:credential> was rejected" });
    });

    it("redacts credential-named keys at any depth", () => {
      const result = redact(
        { nested: { password: "hunter2", token: "tok_123", secret: "s3cret" } },
        [],
      );
      expect(result).toEqual({
        nested: { password: "<redacted>", token: "<redacted>", secret: "<redacted>" },
      });
    });

    it("redacts the authorization key", () => {
      const result = redact({ headers: { authorization: "Bearer tok_123" } }, []);
      expect(result).toEqual({ headers: { authorization: "<redacted>" } });
    });

    it("redacts the cookie key", () => {
      const result = redact({ headers: { cookie: "session=abc" } }, []);
      expect(result).toEqual({ headers: { cookie: "<redacted>" } });
    });

    it("redacts the apiKey key", () => {
      const result = redact({ config: { apiKey: "sk-123" } }, []);
      expect(result).toEqual({ config: { apiKey: "<redacted>" } });
    });
  });

  describe("email addresses", () => {
    it("redacts email addresses", () => {
      const result = redact({ email: "user@example.com" }, []);
      expect(result).toEqual({ email: "<redacted:email>" });
    });

    it("redacts emails embedded in text", () => {
      const result = redact({ msg: "Contact user@example.com for details" }, []);
      expect(result).toEqual({ msg: "Contact <redacted:email> for details" });
    });
  });

  describe("credential inside an error message", () => {
    it("redacts a secret in an error message", () => {
      const error = new Error("Connection failed with super-secret-api-key-abc123");
      const result = redact({ error }, SECRETS);
      expect(result).toEqual({
        error: {
          message: "Connection failed with <redacted:credential>",
          name: "Error",
          stack: expect.stringContaining("<redacted:credential>"),
        },
      });
    });

    it("redacts a connection string in an error message", () => {
      const error = new Error("connect ECONNREFUSED postgres://admin:pw@db:5432/prod");
      const result = redact({ error }, []);
      expect(result).toEqual({
        error: {
          message: "connect ECONNREFUSED <redacted:connection-string>",
          name: "Error",
          stack: expect.any(String),
        },
      });
    });
  });

  describe("string truncation", () => {
    it("truncates strings beyond the configured length", () => {
      const longString = "a".repeat(20_000);
      const result = redact({ content: longString }, []);
      const obj = result as { content: string };
      expect(obj.content.length).toBeLessThan(20_000);
      expect(obj.content).toContain("[truncated]");
    });

    it("does not truncate short strings", () => {
      const result = redact({ content: "hello" }, []);
      expect(result).toEqual({ content: "hello" });
    });
  });

  describe("error handling", () => {
    it("handles nested arrays", () => {
      const result = redact(
        {
          items: [
            ["a", "b"],
            ["c", "d"],
          ],
        },
        [],
      );
      expect(result).toEqual({
        items: [
          ["a", "b"],
          ["c", "d"],
        ],
      });
    });

    it("handles circular structures without throwing", () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;
      const result = redact(circular, []);
      expect(result).toEqual({ a: 1, self: "[Circular]" });
    });

    it("handles deeply nested objects without exceeding max depth", () => {
      let deep: Record<string, unknown> = { value: "bottom" };
      for (let i = 0; i < 30; i++) {
        deep = { nested: deep };
      }
      const result = redact(deep, []);
      expect(result).toBeDefined();
    });

    it("handles null and undefined", () => {
      const result = redact({ a: null, b: undefined }, []);
      expect(result).toEqual({ a: null, b: undefined });
    });

    it("handles Date objects", () => {
      const result = redact({ date: new Date("2024-01-01") }, []);
      expect(result).toEqual({ date: {} });
    });
  });

  describe("diagnostic value preserved", () => {
    it("a redacted line still carries the event, stage, outcome and correlation identifier", () => {
      const payload = {
        event: "pipeline.stage.completed",
        stage: "discovery",
        outcome: "completed",
        correlationId: "req_abc123",
        message: "Connection to postgres://admin:pw@db:5432/prod succeeded",
        credentials: { apiKey: "super-secret-api-key-abc123" },
      };

      const result = redact(payload, SECRETS) as Record<string, unknown>;

      expect(result.event).toBe("pipeline.stage.completed");
      expect(result.stage).toBe("discovery");
      expect(result.outcome).toBe("completed");
      expect(result.correlationId).toBe("req_abc123");
      expect(result.message).toBe("Connection to <redacted:connection-string> succeeded");
      expect(result.credentials).toEqual({ apiKey: "<redacted>" });
    });
  });
});
