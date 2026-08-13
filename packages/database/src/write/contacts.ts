import { desc, eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { z } from "zod";

import type { Executor } from "../client";
import { type ContactRow, contacts } from "../schema/contacts";
import {
  CERTAINTIES,
  CONTACT_EXTRACTION_METHODS,
  MAIL_DELIVERABILITY_STATES,
} from "../schema/enums";
import { databaseNow } from "./clock";
import { RecordNotFoundError, parseInput } from "./errors";

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

    extractionMethod: z.enum(CONTACT_EXTRACTION_METHODS),
    seniorityId: optionalFact,
    roleSourceUrl: z.url("Expected a valid URL.").nullish(),
    mailDeliverability: z.enum(MAIL_DELIVERABILITY_STATES).nullish(),
    aiInvocationId: z.uuid().nullish(),

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

    // Model interpretation requires an invocation reference
    if (
      value.extractionMethod === "model_interpretation" &&
      (value.aiInvocationId === undefined || value.aiInvocationId === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["aiInvocationId"],
        message:
          "A contact extracted through model interpretation must reference the invocation that produced it.",
      });
    }

    // Seniority requires a job title
    if (
      value.seniorityId !== undefined &&
      value.seniorityId !== null &&
      (value.jobTitle === undefined || value.jobTitle === null)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["seniorityId"],
        message: "A seniority level can only be assigned to a contact with a job title.",
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
      extractionMethod: value.extractionMethod,
      seniorityId: value.seniorityId ?? null,
      roleSourceUrl: value.roleSourceUrl ?? null,
      mailDeliverability: value.mailDeliverability ?? null,
      aiInvocationId: value.aiInvocationId ?? null,
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

/**
 * Deletes all contacts for a company.
 */
export async function deleteContactsForCompany(
  executor: Executor,
  companyId: string,
): Promise<void> {
  await executor.delete(contacts).where(eq(contacts.companyId, companyId));
}

/**
 * The most recent contacts for a company, or an empty array when none exist.
 */
export async function getLatestContacts(
  executor: Executor,
  companyId: string,
): Promise<readonly ContactRow[]> {
  return executor
    .select()
    .from(contacts)
    .where(eq(contacts.companyId, companyId))
    .orderBy(desc(contacts.createdAt), desc(contacts.id));
}

export const setContactDoNotContactInputSchema = z.object({
  contactId: z.string().uuid("Expected the contact identifier."),
  reason: z.string().trim().min(1, "Expected a non-blank reason."),
});

export type SetContactDoNotContactInput = z.input<typeof setContactDoNotContactInputSchema>;

/**
 * Marks a contact as not to be contacted, recording the time and reason.
 */
export async function setContactDoNotContact(
  executor: Executor,
  input: SetContactDoNotContactInput,
): Promise<ContactRow> {
  const value = parseInput("The do-not-contact marker", setContactDoNotContactInputSchema, input);

  const [row] = await executor
    .update(contacts)
    .set({
      doNotContactAt: databaseNow(),
      doNotContactReason: value.reason,
      updatedAt: databaseNow(),
    })
    .where(eq(contacts.id, value.contactId))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("contact", value.contactId);
  }

  return row;
}

/**
 * Clears the do-not-contact marker on a contact.
 */
export async function clearContactDoNotContact(
  executor: Executor,
  contactId: string,
): Promise<ContactRow> {
  const [row] = await executor
    .update(contacts)
    .set({
      doNotContactAt: null,
      doNotContactReason: null,
      updatedAt: databaseNow(),
    })
    .where(eq(contacts.id, contactId))
    .returning();

  if (row === undefined) {
    throw new RecordNotFoundError("contact", contactId);
  }

  return row;
}
