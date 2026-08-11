import { resolve } from "node:path";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { type DatabaseOptions, createIsolatedConnection } from "./client";

/**
 * Applies every committed migration.
 *
 * drizzle's migrator records what it has applied in a `__drizzle_migrations`
 * table, so running this against an already-migrated database completes and
 * changes nothing. That is what makes it safe to run on every start and in
 * every test.
 */

/** The committed SQL lives beside the compiled output, not inside it. */
export const MIGRATIONS_FOLDER = resolve(__dirname, "..", "drizzle");

export async function runMigrations(options: DatabaseOptions = {}): Promise<void> {
  // One connection, closed when the migrations finish: a migration holds locks
  // and should not be sharing the application's pool.
  const { database, close } = createIsolatedConnection({ ...options, maxConnections: 1 });

  try {
    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await close();
  }
}
