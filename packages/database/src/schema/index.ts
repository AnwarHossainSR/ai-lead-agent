/**
 * The declared schema. drizzle-kit reads this file to generate migrations, so
 * every table must be re-exported here or it will be silently absent from the
 * generated SQL.
 *
 * These are the raw tables: they are exported for *reads*. Writes go through
 * the validated helpers in `../write`, which are the documented write API — a
 * raw insert bypasses the configuration and evidence checks (design D4).
 */

export * from "./enums";
export * from "./companies";
export * from "./discovery";
export * from "./contacts";
export * from "./website-analysis";
export * from "./leads";
export * from "./outreach";
export * from "./ai-invocations";
export * from "./relations";
