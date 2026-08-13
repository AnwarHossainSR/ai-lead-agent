import type { z } from "zod";

/** The shape Next.js hands a Server Component's `searchParams` prop. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Parses a page's raw search params into validated filters (design D6).
 *
 * Filters live in the URL, never in client state, so a filtered view is a
 * link an operator can bookmark and a Playwright test can navigate to
 * directly. A multi-value param keeps only its first value — this app has
 * no filter that means more than one thing per key.
 *
 * The schema is responsible for degrading gracefully: every field should be
 * optional, defaulted, or use `.catch()`, so a hand-edited or stale URL
 * never crashes the page. This function does not swallow a schema that
 * refuses to parse — that is a schema bug, not a user error.
 */
export function parseSearchParams<Schema extends z.ZodType>(
  searchParams: RawSearchParams,
  schema: Schema,
): z.output<Schema> {
  const flat: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(searchParams)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }

  return schema.parse(flat);
}
