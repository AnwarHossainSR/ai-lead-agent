import { z } from "zod";

import { ConfigurationError, assertUniqueIdentifiers, parseOrThrow } from "../internal/errors";
import { deepFreeze } from "../internal/freeze";

const SUBJECT = "Background job queue configuration";

const queueConfigSchema = z.object({
  concurrency: z.number().int(),
  attempts: z.number().int().positive(),
  backoff: z.number().int().nonnegative().default(5_000),
  timeout: z.number().int().positive(),
});

export type QueueConfig = z.infer<typeof queueConfigSchema>;

export const queueConfigsSchema = z
  .record(z.string(), queueConfigSchema)
  .refine((value) => Object.keys(value).length > 0, {
    message: "Array must contain at least 1 element.",
  });

export type QueueConfigs = z.infer<typeof queueConfigsSchema>;

export function validateConcurrency(subject: string, configs: QueueConfigs): void {
  for (const [queueName, config] of Object.entries(configs)) {
    if (config.concurrency <= 0) {
      throw new ConfigurationError(
        subject,
        `Queue "${queueName}" has a non-positive concurrency: ${config.concurrency}.`,
      );
    }
  }
}

export function parseQueueConfigs(raw: unknown): QueueConfigs {
  const configs = parseOrThrow(SUBJECT, queueConfigsSchema, raw);
  assertUniqueIdentifiers(SUBJECT, Object.keys(configs));
  validateConcurrency(SUBJECT, configs);
  return deepFreeze(configs);
}

const DEFAULT_QUEUE_CONFIGS_RAW = {
  discovery: {
    concurrency: 1,
    attempts: 2,
    backoff: 5_000,
    timeout: 900_000,
  },
  verification: {
    concurrency: 4,
    attempts: 3,
    backoff: 5_000,
    timeout: 120_000,
  },
  "website-analysis": {
    concurrency: 2,
    attempts: 2,
    backoff: 5_000,
    timeout: 300_000,
  },
  "technology-detection": {
    concurrency: 8,
    attempts: 2,
    backoff: 5_000,
    timeout: 60_000,
  },
  "opportunity-analysis": {
    concurrency: 2,
    attempts: 3,
    backoff: 5_000,
    timeout: 180_000,
  },
  "contact-research": {
    concurrency: 3,
    attempts: 3,
    backoff: 5_000,
    timeout: 180_000,
  },
  scoring: {
    concurrency: 8,
    attempts: 2,
    backoff: 5_000,
    timeout: 60_000,
  },
  "research-summary": {
    concurrency: 2,
    attempts: 3,
    backoff: 5_000,
    timeout: 180_000,
  },
  "reply-classification": {
    concurrency: 4,
    attempts: 3,
    backoff: 5_000,
    timeout: 120_000,
  },
} as const;

export const QUEUE_CONFIGS = deepFreeze(parseQueueConfigs(DEFAULT_QUEUE_CONFIGS_RAW));

export type QueueName = keyof typeof QUEUE_CONFIGS;

export function findQueueConfig(name: string): QueueConfig | undefined {
  return QUEUE_CONFIGS[name as QueueName];
}

export function resolveQueueConfig(name: string): QueueConfig {
  const config = findQueueConfig(name);

  if (config === undefined) {
    const known = Object.keys(QUEUE_CONFIGS).join(", ");
    throw new ConfigurationError(SUBJECT, `Unknown queue "${name}". Configured queues: ${known}.`);
  }

  return config;
}
