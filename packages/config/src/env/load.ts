import type { z } from "zod";

/**
 * Raised when environment variables are missing or malformed. Carries the
 * offending variable names so a caller can act on them without re-parsing the
 * message.
 */
export class EnvironmentValidationError extends Error {
  readonly consumer: string;
  readonly variables: readonly string[];

  constructor(consumer: string, variables: readonly string[], message: string) {
    super(message);
    this.name = "EnvironmentValidationError";
    this.consumer = consumer;
    this.variables = variables;
  }
}

/** Stand-in used whenever a raw value would otherwise reach an error message. */
const HIDDEN = "<value hidden>";

/**
 * A connection string or API key must never surface in an error message or a
 * log line, so any occurrence of the value being validated is stripped out of
 * the text Zod produced. Callers learn the expected shape, never the secret.
 */
function withoutRawValue(message: string, rawValue: string | undefined): string {
  if (rawValue === undefined || rawValue.length === 0) {
    return message;
  }
  return message.split(rawValue).join(HIDDEN);
}

/**
 * `z.ZodRawShape` widens its values to the internal `$ZodType`, which does not
 * carry `.description`. Every schema in this package is built from the public
 * `z.ZodType`, so the shape is described in those terms instead.
 */
type EnvShape = Record<string, z.ZodType>;

function explain(
  consumer: string,
  shape: EnvShape,
  source: Record<string, string | undefined>,
  error: z.ZodError,
): { variables: string[]; message: string } {
  const failures = new Map<string, string[]>();

  for (const issue of error.issues) {
    const [first] = issue.path;
    const variable = typeof first === "string" ? first : "(unknown variable)";
    const rawValue = source[variable];
    const detail = rawValue === undefined ? "Not set." : withoutRawValue(issue.message, rawValue);

    const existing = failures.get(variable);
    if (existing) {
      existing.push(detail);
    } else {
      failures.set(variable, [detail]);
    }
  }

  const blocks = [...failures].map(([variable, details]) => {
    const purpose = shape[variable]?.description ?? "No purpose recorded for this variable.";
    return `  ${variable}\n    Purpose: ${purpose}\n    Problem: ${details.join(" ")}`;
  });

  const message = [
    `Invalid environment configuration for ${consumer}.`,
    "",
    ...blocks,
    "",
    "Set these in the git-ignored local environment file. See .env.example for the full list.",
  ].join("\n");

  return { variables: [...failures.keys()], message };
}

/**
 * Builds a loader that validates `process.env` against `schema` exactly once
 * and hands back a frozen result. Passing an explicit `source` bypasses the
 * cache, which is what the tests use; production callers pass nothing.
 */
export function createEnvLoader<Shape extends EnvShape>(
  consumer: string,
  schema: z.ZodObject<Shape>,
): (source?: Record<string, string | undefined>) => Readonly<z.infer<z.ZodObject<Shape>>> {
  let cached: Readonly<z.infer<z.ZodObject<Shape>>> | undefined;

  return function loadEnv(source) {
    if (source === undefined && cached !== undefined) {
      return cached;
    }

    const from = source ?? process.env;
    const result = schema.safeParse(from);

    if (!result.success) {
      const { variables, message } = explain(consumer, schema.shape, from, result.error);
      throw new EnvironmentValidationError(consumer, variables, message);
    }

    const parsed = Object.freeze(result.data);

    if (source === undefined) {
      cached = parsed;
    }

    return parsed;
  };
}
