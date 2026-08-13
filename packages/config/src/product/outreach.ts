import { z } from "zod";

import { ConfigurationError, assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";
import { displayNameSchema, identifierSchema } from "../internal/identifier";

const SUBJECT = "Outreach channel configuration";

export const outreachChannelSchema = z.object({
  id: identifierSchema,
  name: displayNameSchema,
  tone: z.string().trim().min(1, "Expected a tone description for the channel."),
  subjectApplies: z.boolean(),
  maxSubjectLength: z.number().int().positive("Expected a positive maximum subject length."),
  maxBodyLength: z.number().int().positive("Expected a positive maximum body length."),

  // z.literal(false) rather than z.boolean(): every outreach message in this
  // product requires human approval before it is sent, so a channel cannot be
  // switched to automated sending by editing configuration alone. Changing
  // this needs a schema change, a spec change and a review.
  automatedSendingPermitted: z.literal(false),
});

export type OutreachChannel = z.infer<typeof outreachChannelSchema>;

export function parseOutreachChannels(raw: unknown): readonly OutreachChannel[] {
  const channels = parseOrThrow(SUBJECT, z.array(outreachChannelSchema).min(1), raw);

  assertUniqueIdentifiers(
    SUBJECT,
    channels.map((channel) => channel.id),
  );

  return deepFreeze(channels);
}

const OUTREACH_CHANNEL_DATA = [
  {
    id: "email",
    name: "Email",
    tone: "Professional and direct",
    subjectApplies: true,
    maxSubjectLength: 120,
    maxBodyLength: 2000,
    automatedSendingPermitted: false,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    tone: "Conversational and respectful",
    subjectApplies: false,
    maxSubjectLength: 200,
    maxBodyLength: 3000,
    automatedSendingPermitted: false,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    tone: "Friendly and concise",
    subjectApplies: false,
    maxSubjectLength: 60,
    maxBodyLength: 1500,
    automatedSendingPermitted: false,
  },
] as const;

export const OUTREACH_CHANNELS = parseOutreachChannels(OUTREACH_CHANNEL_DATA);

export type OutreachChannelId = (typeof OUTREACH_CHANNEL_DATA)[number]["id"];

export function findOutreachChannel(id: string): OutreachChannel | undefined {
  return OUTREACH_CHANNELS.find((channel) => channel.id === id);
}

export function resolveOutreachChannel(id: string): OutreachChannel {
  const channel = findOutreachChannel(id);

  if (channel === undefined) {
    const known = OUTREACH_CHANNELS.map((entry) => entry.id).join(", ");
    throw new ConfigurationError(
      SUBJECT,
      `Unknown outreach channel "${id}". Configured channels: ${known}.`,
    );
  }

  return channel;
}

/**
 * True only if every configured channel forbids automated sending. Consumers
 * assert on this rather than trusting that nobody edited the configuration.
 */
export function automatedSendingIsForbiddenEverywhere(): boolean {
  return OUTREACH_CHANNELS.every((channel) => channel.automatedSendingPermitted === false);
}
