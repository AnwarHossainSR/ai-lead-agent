import { Client } from "@upstash/qstash";

import type { ApiEnv } from "@mela/config/env";

/** One message currently sitting in QStash's dead-letter queue. */
export interface DlqMessageLike {
  readonly dlqId: string;
  readonly url: string;
  readonly createdAt: number;
  readonly responseStatus?: number;
  readonly responseBody?: string;
}

/**
 * The slice of the QStash client the operations module actually calls.
 * Kept narrow and separate from `Client` so a test can supply a plain object
 * instead of constructing a real QStash client against a live token.
 */
export interface QStashDlqClient {
  dlq: {
    listMessages(options?: {
      count?: number;
    }): Promise<{ messages: DlqMessageLike[]; cursor?: string }>;
    retry(dlqId: string): Promise<unknown>;
  };
}

export const QSTASH_CLIENT = "QSTASH_CLIENT";

export function createQStashClient(env: ApiEnv): QStashDlqClient {
  return new Client({ baseUrl: env.QSTASH_URL, token: env.QSTASH_TOKEN });
}
