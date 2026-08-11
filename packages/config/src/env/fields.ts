import { z } from "zod";

/**
 * Field builders shared by the consumer schemas. Every message states the
 * expected shape and never repeats the value it rejected.
 */

function urlWithProtocol(protocols: readonly string[], example: string) {
  const allowed = protocols.map((protocol) => `${protocol}:`);

  return z.string().refine(
    (value) => {
      try {
        return allowed.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: `Expected a URL of the form ${example}` },
  );
}

/** A PostgreSQL connection string, e.g. `postgresql://user:pass@host:5432/db`. */
export const postgresUrl = urlWithProtocol(
  ["postgres", "postgresql"],
  "postgresql://user:password@host:5432/database",
);

/** A Redis connection string, e.g. `redis://localhost:6379`. */
export const redisUrl = urlWithProtocol(["redis", "rediss"], "redis://host:6379");

/** An HTTP(S) URL, used for service base URLs and browser origins. */
export const httpUrl = urlWithProtocol(["http", "https"], "http://localhost:3000");

/**
 * A TCP port. Environment values are always strings, so this parses rather
 * than coerces: `z.coerce.number()` turns "abc" into NaN and reports a type
 * mismatch, which does not tell the reader what shape was expected.
 */
export const tcpPort = z
  .string()
  .regex(/^\d+$/, "Expected a TCP port number between 1 and 65535.")
  .transform((value) => Number.parseInt(value, 10))
  .refine((port) => port >= 1 && port <= 65535, "Expected a TCP port number between 1 and 65535.");

/** A positive whole number, e.g. a token limit, a timeout in milliseconds, or a window in hours. */
export const positiveInteger = z
  .string()
  .regex(/^\d+$/, "Expected a positive whole number.")
  .transform((value) => Number.parseInt(value, 10))
  .refine((value) => value > 0, "Expected a positive whole number.");

/** A positive decimal amount, e.g. a USD spend ceiling. */
export const positiveAmount = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Expected a positive number, e.g. 25 or 25.50.")
  .transform((value) => Number.parseFloat(value))
  .refine((value) => value > 0, "Expected a positive number, e.g. 25 or 25.50.");
