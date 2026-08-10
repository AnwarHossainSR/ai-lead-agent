import {
  INITIAL_LEAD_STATUS,
  type LeadStatus,
  assertTransition,
  classifyPriority,
  resolveScoreComponent,
} from "@mela/config";
import { and, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type LeadRow, leads } from "../schema/leads";
import { databaseNow } from "./clock";
import {
  DuplicateLeadError,
  RecordNotFoundError,
  WriteValidationError,
  isUniqueViolation,
  parseInput,
} from "./errors";
import { serviceIdSchema } from "./identifiers";

/**
 * The write API for leads.
 *
 * Two things are derived here rather than accepted from the caller: the total
 * score, which is the sum of the components, and the priority, which is the
 * band that total falls into. Accepting either would allow a lead whose total
 * contradicts its breakdown, or whose priority contradicts its total — a
 * number nobody could reproduce.
 */

const COMPANY_ID_CONSTRAINT = "leads_company_id_key";

/** Maps each configured scoring component to the column that stores it. */
const SCORE_COLUMNS = {
  business_fit: "businessFitScore",
  technical_opportunity: "technicalOpportunityScore",
  business_opportunity: "businessOpportunityScore",
  decision_maker_found: "decisionMakerFoundScore",
  company_quality: "companyQualityScore",
} as const;

type ScoreKey = keyof typeof SCORE_COLUMNS;

const componentScore = z
  .number()
  .int("Expected a whole number of points.")
  .min(0, "Expected at least 0 points.");

export const insertLeadInputSchema = z
  .object({
    companyId: z.uuid("Expected the identifier of the company this lead is for."),

    scores: z.object({
      business_fit: componentScore,
      technical_opportunity: componentScore,
      business_opportunity: componentScore,
      decision_maker_found: componentScore,
      company_quality: componentScore,
    }),

    // Required: a score whose reasoning is not written down cannot be argued
    // with, corrected, or used to open a conversation.
    scoreExplanation: z
      .string()
      .trim()
      .min(1, "Expected an explanation of how this score was reached."),

    recommendedServiceId: serviceIdSchema.nullish(),
    contactReason: z
      .string()
      .trim()
      .min(1, "Expected a reason or nothing at all; a blank string is not a reason.")
      .nullish(),

    isExample: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    // The maximums are configuration and may be retuned, so they are read at
    // validation time rather than baked into the schema.
    for (const key of Object.keys(SCORE_COLUMNS) as ScoreKey[]) {
      const submitted = value.scores[key];
      const { maximum, name } = resolveScoreComponent(key);

      if (submitted > maximum) {
        ctx.addIssue({
          code: "custom",
          path: ["scores", key],
          message: `${name} scored ${submitted}, but its configured maximum is ${maximum}.`,
        });
      }
    }
  });

export type InsertLeadInput = z.input<typeof insertLeadInputSchema>;

export async function insertLead(executor: Executor, input: InsertLeadInput): Promise<LeadRow> {
  const value = parseInput("The lead", insertLeadInputSchema, input);

  const total = Object.values(value.scores).reduce((sum, points) => sum + points, 0);
  const priority = classifyPriority(total);

  try {
    const [row] = await executor
      .insert(leads)
      .values({
        id: uuidv7(),
        companyId: value.companyId,
        leadScore: total,
        priority,
        businessFitScore: value.scores.business_fit,
        technicalOpportunityScore: value.scores.technical_opportunity,
        businessOpportunityScore: value.scores.business_opportunity,
        decisionMakerFoundScore: value.scores.decision_maker_found,
        companyQualityScore: value.scores.company_quality,
        scoreExplanation: value.scoreExplanation,
        recommendedServiceId: value.recommendedServiceId ?? null,
        contactReason: value.contactReason ?? null,
        // A new lead always starts where the configured lifecycle starts. A
        // caller cannot open a lead directly at `qualified`.
        status: INITIAL_LEAD_STATUS,
        isExample: value.isExample,
      })
      .returning();

    if (row === undefined) {
      throw new Error("The lead insert returned no row.");
    }

    return row;
  } catch (error) {
    if (isUniqueViolation(error, COMPANY_ID_CONSTRAINT)) {
      throw new DuplicateLeadError(value.companyId);
    }

    throw error;
  }
}

/**
 * Moves a lead to `nextStatus`, or refuses.
 *
 * The legality check runs before anything is written and the update is
 * conditional on the status that was checked, so a concurrent change cannot
 * slip an illegal transition through the gap between reading and writing.
 * `assertTransition` raises `LeadStatusTransitionError`, which names the
 * source, the target and the permitted targets.
 */
export async function applyLeadStatusChange(
  executor: Executor,
  leadId: string,
  nextStatus: LeadStatus,
): Promise<LeadRow> {
  const [current] = await executor
    .select({ status: leads.status })
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  if (current === undefined) {
    throw new RecordNotFoundError("lead", leadId);
  }

  assertTransition(current.status, nextStatus);

  const [row] = await executor
    .update(leads)
    .set({ status: nextStatus, updatedAt: databaseNow() })
    .where(and(eq(leads.id, leadId), eq(leads.status, current.status)))
    .returning();

  if (row === undefined) {
    throw new WriteValidationError("The lead status change", [
      `Lead ${leadId} left status "${current.status}" while the change was being applied. Nothing was written; read the lead again and retry.`,
    ]);
  }

  return row;
}
