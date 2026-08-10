import { type SQL, sql } from "drizzle-orm";

/**
 * `now()`, evaluated by PostgreSQL.
 *
 * Every timestamp this package writes comes from the database clock rather
 * than from `new Date()` on whichever host happens to be running the code.
 * With two clocks, a row inserted with `DEFAULT now()` and then updated a
 * millisecond later can end up with `updated_at` *before* `created_at`, and
 * an outreach record can appear to have been sent before it was approved —
 * which is a constraint violation caused by nothing but clock skew.
 *
 * Inside a transaction `now()` is the transaction start time, so two writes in
 * one transaction share a timestamp rather than disagreeing about the order
 * they happened in.
 */
export function databaseNow(): SQL {
  return sql`now()`;
}

/**
 * A set of column assignments where any column may be given a SQL expression
 * instead of a literal — which is what `databaseNow()` is. Drizzle's `.set()`
 * already accepts both; this is for the intermediate objects built up before
 * the call.
 */
export type Assignments<T> = { [K in keyof T]?: T[K] | SQL };
