import { expect } from "vitest";

/**
 * Asserts that a statement was refused by a named PostgreSQL constraint.
 *
 * Drizzle wraps driver errors in a `DrizzleQueryError` whose message is the
 * failing SQL, so matching the constraint name against the message never
 * matches — the name is on the `cause`. Tests that check "the database refuses
 * this, not only the helper" have to look there, or they pass for the wrong
 * reason the moment the helper starts throwing first.
 */
export async function expectConstraintViolation(
  work: Promise<unknown>,
  constraint: string,
): Promise<void> {
  let thrown: unknown;

  try {
    await work;
  } catch (error) {
    thrown = error;
  }

  expect(thrown, `Expected the statement to be refused by ${constraint}.`).toBeDefined();
  expect(constraintNames(thrown)).toContain(constraint);
}

/**
 * Asserts that a statement was refused with a message matching `pattern`.
 *
 * For use with a `RAISE EXCEPTION` message (e.g. the audit log's append-only
 * trigger) rather than a named constraint — those have no constraint name to
 * match against, only the text after `RAISE EXCEPTION`. Drizzle wraps the raw
 * driver error in a `DrizzleQueryError` whose own `message` is the failing
 * SQL, so the real text is on `.cause`, matching the layout
 * `expectConstraintViolation` already walks.
 */
export async function expectErrorMatching(work: Promise<unknown>, pattern: RegExp): Promise<void> {
  let thrown: unknown;

  try {
    await work;
  } catch (error) {
    thrown = error;
  }

  expect(
    thrown,
    `Expected the statement to be refused with a message matching ${pattern}.`,
  ).toBeDefined();

  const cause = thrown instanceof Error ? thrown.cause : undefined;
  const message = cause instanceof Error ? cause.message : String(thrown);

  expect(message).toMatch(pattern);
}

function constraintNames(error: unknown): string[] {
  const names: string[] = [];
  let candidate: unknown = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof candidate !== "object" || candidate === null) {
      break;
    }

    const { constraint_name: name } = candidate as { constraint_name?: unknown };
    if (typeof name === "string") {
      names.push(name);
    }

    candidate = (candidate as { cause?: unknown }).cause;
  }

  return names;
}
