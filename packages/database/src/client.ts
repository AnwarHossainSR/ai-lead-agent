import { hydrateEnvironment, loadDatabaseEnv } from "@mela/config/env";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * A transaction handle. Every write helper accepts one of these *or* the
 * pooled client, so callers can compose helpers into a single atomic unit
 * without the helpers knowing whether they are inside a transaction.
 */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DatabaseOptions {
  /** Connection string. Defaults to the validated `DATABASE_URL`. */
  readonly url?: string;
  /** Maximum pooled connections. */
  readonly maxConnections?: number;
}

interface Connection {
  readonly database: Database;
  readonly sql: postgres.Sql;
}

function openConnection(options: DatabaseOptions): Connection {
  const url = options.url ?? resolveUrlFromEnvironment();

  const sql = postgres(url, {
    max: options.maxConnections ?? 10,
    onnotice: () => {
      // postgres-js prints every PostgreSQL NOTICE to stderr, which makes a
      // re-run of the migrations look alarming ("relation already exists,
      // skipping"). Dropping them swallows no failure: errors arrive as
      // rejected promises, never as notices.
    },
  });

  return { database: drizzle(sql, { schema }), sql };
}

function resolveUrlFromEnvironment(): string {
  hydrateEnvironment();
  return loadDatabaseEnv().DATABASE_URL;
}

let shared: Connection | null = null;

/**
 * The pooled client the application uses. Opened on first call and reused: a
 * pool per import would exhaust PostgreSQL's connection slots.
 */
export function getDatabase(): Database {
  shared ??= openConnection({});
  return shared.database;
}

/**
 * Closes the shared pool. The API calls this on shutdown; without it the
 * process hangs on an open socket.
 */
export async function closeConnection(): Promise<void> {
  if (shared === null) {
    return;
  }

  const { sql } = shared;
  shared = null;
  await sql.end({ timeout: 5 });
}

/**
 * An independent pool for callers that must not share the application's — the
 * migration runner, the seed script and the test harness, each of which opens
 * and closes its own.
 */
export function createIsolatedConnection(options: DatabaseOptions = {}): {
  database: Database;
  close: () => Promise<void>;
} {
  const { database, sql } = openConnection(options);

  return {
    database,
    close: async (): Promise<void> => {
      await sql.end({ timeout: 5 });
    },
  };
}

/**
 * Runs `work` in a transaction, committing on return and rolling back on
 * throw. Multi-table writes go through here so a partial write cannot survive
 * an error.
 */
export async function withTransaction<T>(
  database: Database,
  work: (tx: Executor) => Promise<T>,
): Promise<T> {
  return database.transaction(async (tx) => work(tx));
}
