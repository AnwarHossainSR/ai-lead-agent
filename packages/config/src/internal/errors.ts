import type { z } from "zod";

/**
 * Raised when product configuration fails validation at load time, or when a
 * consumer asks for an identifier the configuration does not define. Both are
 * programming or configuration errors, never recoverable runtime conditions —
 * the alternative would be returning a default, which is how a fabricated fact
 * enters the system.
 */
export class ConfigurationError extends Error {
  readonly subject: string;

  constructor(subject: string, detail: string) {
    super(`${subject}: ${detail}`);
    this.name = "ConfigurationError";
    this.subject = subject;
  }
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path} — ${issue.message}`;
    })
    .join("; ");
}

/**
 * Validates `input` and returns the parsed value, or throws naming the failing
 * field path and the reason. Nothing partially validated is ever returned.
 */
export function parseOrThrow<Output>(
  subject: string,
  schema: z.ZodType<Output>,
  input: unknown,
): Output {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ConfigurationError(subject, formatIssues(result.error));
  }

  return result.data;
}

/** Refuses a configuration list that defines the same identifier twice. */
export function assertUniqueIdentifiers(subject: string, ids: readonly string[]): void {
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicated.add(id);
    }
    seen.add(id);
  }

  if (duplicated.size > 0) {
    const list = [...duplicated].sort().join(", ");
    throw new ConfigurationError(subject, `Duplicate identifier: ${list}.`);
  }
}
