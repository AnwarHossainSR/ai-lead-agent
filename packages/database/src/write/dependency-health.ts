import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import {
  DEPENDENCY_HEALTH_STATUSES,
  type DependencyHealthSampleRow,
  dependencyHealthSamples,
} from "../schema";

export const recordDependencyHealthSampleInputSchema = z
  .object({
    dependency: z.string().trim().min(1, "Expected a dependency name."),
    status: z.enum(DEPENDENCY_HEALTH_STATUSES),
    latencyMs: z.number().int().nonnegative().nullable(),
    failureReason: z.string().trim().min(1).nullable(),
    sampledAt: z.date().optional(),
  })
  // The two CHECK constraints on the table say the same thing; stating it here
  // as well means a caller gets a message naming the field instead of a
  // constraint violation naming the constraint.
  .superRefine((value, ctx) => {
    if ((value.status === "down") !== (value.latencyMs === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["latencyMs"],
        message:
          value.status === "down"
            ? "A dependency that did not answer has no latency; expected null."
            : "A dependency that answered has a latency; expected a number.",
      });
    }

    if ((value.status === "up") !== (value.failureReason === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["failureReason"],
        message:
          value.status === "up"
            ? "A healthy sample needs no reason; expected null."
            : "A sample that is not up must say why.",
      });
    }
  });

export type RecordDependencyHealthSampleInput = z.infer<
  typeof recordDependencyHealthSampleInputSchema
>;

/** Stores one probe result (design D6). */
export async function recordDependencyHealthSample(
  executor: Executor,
  input: RecordDependencyHealthSampleInput,
): Promise<DependencyHealthSampleRow> {
  const parsed = recordDependencyHealthSampleInputSchema.parse(input);

  const [row] = await executor
    .insert(dependencyHealthSamples)
    .values({
      id: uuidv7(),
      dependency: parsed.dependency,
      status: parsed.status,
      latencyMs: parsed.latencyMs,
      failureReason: parsed.failureReason,
      ...(parsed.sampledAt === undefined ? {} : { sampledAt: parsed.sampledAt }),
    })
    .returning();

  if (row === undefined) {
    throw new Error("Inserting a dependency health sample returned no row.");
  }

  return row;
}
