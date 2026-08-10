/**
 * The `unknown` marker.
 *
 * A researched claim is either established or it is not, and the product
 * principles forbid presenting a guess as a fact. "Not established" therefore
 * needs a value of its own, because the usual stand-ins all read as data at
 * the call site: `""` renders as a blank name, `0` is a real accessibility
 * score, and a bare `null` is one `??` away from becoming a fabricated
 * default. `Maybe<T>` makes the distinction impossible to skip past, since the
 * value cannot be reached without first asking whether there is one.
 *
 * In PostgreSQL, unknown is SQL `NULL`. {@link fromNullable} is the read
 * boundary and {@link toNullable} the write boundary.
 */

export interface Known<T> {
  readonly known: true;
  readonly value: T;
}

export interface Unknown {
  readonly known: false;
}

export type Maybe<T> = Known<T> | Unknown;

/** The single unknown value — every unknown field shares it. */
export const UNKNOWN: Unknown = Object.freeze({ known: false });

export function known<T>(value: T): Known<T> {
  return { known: true, value };
}

export function isKnown<T>(fact: Maybe<T>): fact is Known<T> {
  return fact.known;
}

export function isUnknown<T>(fact: Maybe<T>): fact is Unknown {
  return !fact.known;
}

/**
 * The value, or `fallback` when it was never established. The fallback is a
 * presentation choice made by the caller ("—", "Not researched"), never a
 * value that is then stored or reasoned over.
 */
export function unwrapOr<T>(fact: Maybe<T>, fallback: T): T {
  return fact.known ? fact.value : fallback;
}

/** Transforms a known value, leaving unknown unknown. */
export function mapKnown<T, U>(fact: Maybe<T>, transform: (value: T) => U): Maybe<U> {
  return fact.known ? known(transform(fact.value)) : UNKNOWN;
}

/** Read boundary: SQL `NULL` becomes unknown. */
export function fromNullable<T>(value: T | null | undefined): Maybe<T> {
  return value === null || value === undefined ? UNKNOWN : known(value);
}

/** Write boundary: unknown becomes SQL `NULL`. */
export function toNullable<T>(fact: Maybe<T>): T | null {
  return fact.known ? fact.value : null;
}

export class BlankTextError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(
      `${field}: a blank string is not a fact. Store SQL NULL, and represent it as UNKNOWN, when the value could not be established.`,
    );
    this.name = "BlankTextError";
    this.field = field;
  }
}

/**
 * Read boundary for nullable text columns.
 *
 * Throws on a blank value rather than quietly converting it to unknown: a
 * blank in a nullable column means something wrote a placeholder around these
 * helpers, and surfacing that is the entire point of the marker.
 */
export function fromNullableText(field: string, value: string | null | undefined): Maybe<string> {
  if (value === null || value === undefined) {
    return UNKNOWN;
  }

  if (value.trim().length === 0) {
    throw new BlankTextError(field);
  }

  return known(value);
}

/** Write boundary for nullable text columns; refuses to persist a blank. */
export function toNullableText(field: string, fact: Maybe<string>): string | null {
  if (!fact.known) {
    return null;
  }

  if (fact.value.trim().length === 0) {
    throw new BlankTextError(field);
  }

  return fact.value;
}
