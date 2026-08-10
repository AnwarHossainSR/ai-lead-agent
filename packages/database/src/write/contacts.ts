import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type ContactRow, contacts } from "../schema/contacts";
import { CERTAINTIES } from "../schema/enums";
import { parseInput } from "./errors";

/**
 * The write API for contacts.
 *
 * The rule this enforces, twice — here and again as a CHECK constraint — is
 * that an email or a phone number arrives with the URL it was seen at. A
 * pattern-guessed address (`firstname.lastname@company.ae`) looks identical to
 * a real one, so the only durable defence is refusing to store one that cannot
 * say where it came from.
 */

const optionalFact = z
  .string()
  .trim()
  .min(1, "Expected a value or nothing at all; a blank string is not a fact.")
  .nullish();

export const insertContactInputSchema = z
  .object({
    companyId: z.uuid("Expected the identifier of the company this person works for."),

    name: z.string().trim().min(1, "Expected the contact's name."),
    jobTitle: optionalFact,
    linkedinUrl: optionalFact,
    email: z.email("Expected a valid email address.").nullish(),
    phone: optionalFact,

    certainty: z.enum(CERTAINTIES),

    researchSource: z.string().trim().min(1, "Expected the source this contact was found in."),
    sourceUrl: z.url("Expected the URL this contact was found at.").nullish(),

    isExample: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const hasContactDetail =
      (value.email !== undefined && value.email !== null) ||
      (value.phone !== undefined && value.phone !== null);

    if (hasContactDetail && (value.sourceUrl === undefined || value.sourceUrl === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message:
          "An email or phone number must arrive with the URL it was observed at. A contact detail that cannot say where it came from is indistinguishable from a guess.",
      });
    }
  });

export type InsertContactInput = z.input<typeof insertContactInputSchema>;

export async function insertContact(
  executor: Executor,
  input: InsertContactInput,
): Promise<ContactRow> {
  const value = parseInput("The contact", insertContactInputSchema, input);

  const [row] = await executor
    .insert(contacts)
    .values({
      id: uuidv7(),
      companyId: value.companyId,
      name: value.name,
      jobTitle: value.jobTitle ?? null,
      linkedinUrl: value.linkedinUrl ?? null,
      email: value.email ?? null,
      phone: value.phone ?? null,
      certainty: value.certainty,
      researchSource: value.researchSource,
      sourceUrl: value.sourceUrl ?? null,
      isExample: value.isExample,
    })
    .returning();

  if (row === undefined) {
    throw new Error("The contact insert returned no row.");
  }

  return row;
}
