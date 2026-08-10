import type { z } from "zod";

/**
 * Errors raised by the write helpers.
 *
 * Every one of them means the write did not happen. None of them carries the
 * connection string, and none carries a value the caller did not already have.
 */

export class WriteValidationError extends Error {
  readonly subject: string;
  readonly issues: readonly string[];

  constructor(subject: string, issues: readonly string[]) {
    super(`${subject} was rejected: ${issues.join("; ")}`);
    this.name = "WriteValidationError";
    this.subject = subject;
    this.issues = issues;
  }
}

/** Formats Zod issues as `field.path — message`, keeping the path visible. */
export function toIssueList(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path} — ${issue.message}`;
  });
}

export function parseInput<Output>(
  subject: string,
  schema: z.ZodType<Output>,
  input: unknown,
): Output {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new WriteValidationError(subject, toIssueList(result.error));
  }

  return result.data;
}

/**
 * A company already exists on this normalized domain.
 *
 * Carries the identifier of the record that is already there, so the caller
 * can merge into it instead of guessing which of two rows is real.
 */
export class DuplicateCompanyError extends Error {
  readonly normalizedDomain: string;
  readonly existingCompanyId: string | null;

  constructor(normalizedDomain: string, existingCompanyId: string | null) {
    const existing =
      existingCompanyId === null ? "another company" : `company ${existingCompanyId}`;

    super(`A company with normalized domain "${normalizedDomain}" already exists: ${existing}.`);
    this.name = "DuplicateCompanyError";
    this.normalizedDomain = normalizedDomain;
    this.existingCompanyId = existingCompanyId;
  }
}

/** A lead already exists for this company. */
export class DuplicateLeadError extends Error {
  readonly companyId: string;

  constructor(companyId: string) {
    super(`Company ${companyId} already has a lead. A company is scored once.`);
    this.name = "DuplicateLeadError";
    this.companyId = companyId;
  }
}

/** The row a write was aimed at is not there. */
export class RecordNotFoundError extends Error {
  readonly table: string;
  readonly id: string;

  constructor(table: string, id: string) {
    super(`No ${table} record with identifier ${id}.`);
    this.name = "RecordNotFoundError";
    this.table = table;
    this.id = id;
  }
}

const UNIQUE_VIOLATION = "23505";

/**
 * True when `error` is PostgreSQL's unique-violation on the named constraint.
 *
 * Drizzle wraps driver errors in a `DrizzleQueryError` whose `message` is the
 * failing SQL and whose `cause` is the real PostgresError, so the chain has to
 * be walked — matching on the top-level object alone silently never matches
 * and every duplicate surfaces as a raw query dump.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  let candidate: unknown = error;

  // Bounded, so a self-referential cause cannot loop forever.
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof candidate !== "object" || candidate === null) {
      return false;
    }

    const { code, constraint_name: constraintName } = candidate as {
      code?: unknown;
      constraint_name?: unknown;
    };

    if (code === UNIQUE_VIOLATION && constraintName === constraint) {
      return true;
    }

    candidate = (candidate as { cause?: unknown }).cause;
  }

  return false;
}
