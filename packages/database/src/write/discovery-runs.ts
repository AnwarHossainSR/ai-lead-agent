import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type CompanyDiscoverySourceRow, companyDiscoverySources } from "../schema/discovery";
import {
  type DiscoveryRunRow,
  type DiscoveryRunSourceRow,
  discoveryRunSources,
  discoveryRuns,
} from "../schema/discovery";
import { DISCOVERY_RUN_OUTCOMES, DISCOVERY_SOURCE_OUTCOMES } from "../schema/enums";
import { databaseNow } from "./clock";
import { RecordNotFoundError, parseInput } from "./errors";
import {
  cityIdSchema,
  countryIdSchema,
  discoverySourceIdSchema,
  industryIdSchema,
  refineCityBelongsToCountry,
} from "./identifiers";

/**
 * The write API for discovery runs (design D6). Reads use the exported
 * tables; everything that creates or ends a run goes through here so a run
 * can never be recorded with an invalid territory, a negative count, or a
 * finish time before its start.
 */

const positiveInteger = z.number().int().positive("Expected a positive integer.");

export const startDiscoveryRunInputSchema = z
  .object({
    countryId: countryIdSchema,
    cityId: cityIdSchema.nullish(),
    industryId: industryIdSchema,
    candidateLimit: positiveInteger,
    durationLimitSeconds: positiveInteger,
  })
  .superRefine(refineCityBelongsToCountry);

export type StartDiscoveryRunInput = z.input<typeof startDiscoveryRunInputSchema>;

/**
 * Opens a run in the `running` state. The one-running-per-territory partial
 * unique index refuses a second run for the same (country, industry) while the
 * first is still in flight.
 */
export async function startDiscoveryRun(
  executor: Executor,
  input: StartDiscoveryRunInput,
): Promise<DiscoveryRunRow> {
  const value = parseInput("The discovery run", startDiscoveryRunInputSchema, input);

  const [row] = await executor
    .insert(discoveryRuns)
    .values({
      id: uuidv7(),
      countryId: value.countryId,
      cityId: value.cityId ?? null,
      industryId: value.industryId,
      outcome: "running",
      candidateLimit: value.candidateLimit,
      durationLimitSeconds: value.durationLimitSeconds,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The discovery run insert returned no row.");
  }

  return row;
}

const nonNegativeInteger = z.number().int().min(0, "Expected a non-negative integer.");

export const recordDiscoveryRunSourceInputSchema = z.object({
  runId: z.string().uuid("Expected the run identifier."),
  sourceId: discoverySourceIdSchema,
  outcome: z.enum(DISCOVERY_SOURCE_OUTCOMES),
  returnedCount: nonNegativeInteger.default(0),
  storedCount: nonNegativeInteger.default(0),
  duplicateCount: nonNegativeInteger.default(0),
  rejectedCount: nonNegativeInteger.default(0),
  rejections: z
    .array(
      z.object({
        reason: z.string().trim().min(1, "Expected a rejection reason."),
        count: nonNegativeInteger,
      }),
    )
    .default([]),
  note: z
    .string()
    .trim()
    .min(1, "Expected a note or nothing at all; a blank string is not a note.")
    .nullish(),
});

export type RecordDiscoveryRunSourceInput = z.input<typeof recordDiscoveryRunSourceInputSchema>;

/**
 * Records what one source contributed to a run. Insert rather than upsert: a
 * run consults each source once, and the (run_id, source_id) uniqueness would
 * make a second write a bug worth surfacing rather than silently folding in.
 */
export async function recordDiscoveryRunSource(
  executor: Executor,
  input: RecordDiscoveryRunSourceInput,
): Promise<DiscoveryRunSourceRow> {
  const value = parseInput("The per-source result", recordDiscoveryRunSourceInputSchema, input);

  const [row] = await executor
    .insert(discoveryRunSources)
    .values({
      id: uuidv7(),
      runId: value.runId,
      sourceId: value.sourceId,
      outcome: value.outcome,
      returnedCount: value.returnedCount,
      storedCount: value.storedCount,
      duplicateCount: value.duplicateCount,
      rejectedCount: value.rejectedCount,
      rejections: value.rejections,
      note: value.note ?? null,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The per-source result insert returned no row.");
  }

  return row;
}

export const finishDiscoveryRunInputSchema = z.object({
  outcome: z
    .enum(DISCOVERY_RUN_OUTCOMES)
    .refine((outcome) => outcome !== "running", "Expected a terminal outcome, not 'running'."),
  failureReason: z
    .string()
    .trim()
    .min(1, "Expected a failure reason or nothing at all; a blank string is not a reason.")
    .nullish(),
});

export type FinishDiscoveryRunInput = z.input<typeof finishDiscoveryRunInputSchema>;

/**
 * Closes a run. The finish timestamp comes from the database clock and the
 * CHECK constraint rejects anything earlier than the start — a run that
 * finished before it started is a contradiction, not a fact.
 */
export async function finishDiscoveryRun(
  executor: Executor,
  id: string,
  input: FinishDiscoveryRunInput,
): Promise<DiscoveryRunRow> {
  const value = parseInput("The discovery run finish", finishDiscoveryRunInputSchema, input);

  const [row] = await executor
    .update(discoveryRuns)
    .set({
      finishedAt: databaseNow(),
      outcome: value.outcome,
      failureReason: value.failureReason ?? null,
    })
    .where(eq(discoveryRuns.id, id))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("discovery run", id);
  }

  return row;
}

export const recordCompanyDiscoverySourceInputSchema = z.object({
  companyId: z.string().uuid("Expected the company identifier."),
  sourceId: discoverySourceIdSchema,
  sourceUrl: z.url("Expected the URL this company was found at."),
});

export type RecordCompanyDiscoverySourceInput = z.input<
  typeof recordCompanyDiscoverySourceInputSchema
>;

/**
 * Records that a source found a company, or advances the existing record when
 * the same source finds it again (spec: rediscovery updates the time rather
 * than adding a row). The composite primary key makes the upsert unambiguous.
 */
export async function recordCompanyDiscoverySource(
  executor: Executor,
  input: RecordCompanyDiscoverySourceInput,
): Promise<CompanyDiscoverySourceRow> {
  const value = parseInput(
    "The company discovery source",
    recordCompanyDiscoverySourceInputSchema,
    input,
  );

  const [row] = await executor
    .insert(companyDiscoverySources)
    .values({
      companyId: value.companyId,
      sourceId: value.sourceId,
      sourceUrl: value.sourceUrl,
    })
    .onConflictDoUpdate({
      target: [companyDiscoverySources.companyId, companyDiscoverySources.sourceId],
      set: {
        // The claim URL is where the company can be inspected *now*; the first
        // time it was seen is preserved.
        lastSeenAt: databaseNow(),
        sourceUrl: value.sourceUrl,
      },
    })
    .returning();

  if (row === undefined) {
    throw new Error("The company discovery source upsert returned no row.");
  }

  return row;
}
