import type { z } from "zod";

/**
 * The validation path (design D4): parse the provider's response against
 * the prompt's output schema. On failure, one repair attempt carries the
 * validation error back to the model. A second failure throws naming the
 * prompt, version and failing fields.
 *
 * No defaults, no `partial: true`, no dropping failing fields — those are
 * the mechanisms by which a fabricated value enters a database that
 * promised not to hold one.
 */

export class OutputValidationError extends Error {
  readonly promptName: string;
  readonly promptVersion: number;
  readonly fields: string[];

  constructor(promptName: string, promptVersion: number, fields: string[], cause: z.ZodError) {
    const fieldList = fields.join(", ");
    super(
      `Prompt "${promptName}" v${promptVersion} produced invalid output. ` +
        `Failing fields: ${fieldList}.`,
    );
    this.name = "OutputValidationError";
    this.promptName = promptName;
    this.promptVersion = promptVersion;
    this.fields = fields;
    this.cause = cause;
  }
}

/**
 * Parses `content` against `schema`. Returns the parsed value on success.
 * On the first failure, returns the Zod error so the caller can feed it
 * back to the model for a repair attempt. On the second failure, throws
 * `OutputValidationError`.
 *
 * @returns The parsed value, or on the first attempt, a `ZodError` that
 *   the caller should pass back as `repairError` on the second call.
 */
export function parseOutput<T>(
  schema: z.ZodType<T>,
  content: unknown,
): { ok: true; value: T } | { ok: false; error: z.ZodError } {
  const result = schema.safeParse(content);

  if (result.success) {
    return { ok: true, value: result.data };
  }

  return { ok: false, error: result.error };
}

/**
 * Extracts the failing field paths from a Zod error as a flat list.
 */
export function failingFields(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return path;
  });
}
