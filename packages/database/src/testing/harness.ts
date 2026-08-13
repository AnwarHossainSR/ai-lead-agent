import { hydrateEnvironment, loadDatabaseEnv } from "@mela/config/env";
import { sql } from "drizzle-orm";
import postgres from "postgres";

import { type Database, createIsolatedConnection } from "../client";
import { runMigrations } from "../migrate";

/**
 * The integration test harness.
 *
 * Tests run against a real PostgreSQL — the constraints being tested are
 * PostgreSQL constraints, and an in-memory substitute would prove nothing
 * about them. They run against a *separate* database whose name is the
 * development one with `_test` appended, created here if it does not exist, so
 * a test run cannot truncate the database somebody is developing against.
 *
 * Testcontainers would also work and was rejected: it adds a heavy dependency
 * for a service the developer already has running under Docker Compose
 * (design D10).
 */

const TEST_DATABASE_SUFFIX = "_test";

/** The `_test` sibling of the configured development database. */
export function resolveTestDatabaseUrl(developmentUrl: string): {
  testUrl: string;
  adminUrl: string;
  databaseName: string;
} {
  const url = new URL(developmentUrl);
  const developmentName = url.pathname.replace(/^\//, "");

  if (developmentName.length === 0) {
    throw new Error("DATABASE_URL names no database, so the test database cannot be derived.");
  }

  if (developmentName.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `DATABASE_URL already points at "${developmentName}". Point it at the development database; the harness derives the test one.`,
    );
  }

  const databaseName = `${developmentName}${TEST_DATABASE_SUFFIX}`;

  const testUrl = new URL(developmentUrl);
  testUrl.pathname = `/${databaseName}`;

  // CREATE DATABASE cannot run inside the database being created, so the
  // maintenance database is used to issue it.
  const adminUrl = new URL(developmentUrl);
  adminUrl.pathname = "/postgres";

  return { testUrl: testUrl.toString(), adminUrl: adminUrl.toString(), databaseName };
}

async function ensureDatabaseExists(adminUrl: string, databaseName: string): Promise<void> {
  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });

  try {
    const existing = await admin`SELECT 1 FROM pg_database WHERE datname = ${databaseName}`;

    if (existing.length === 0) {
      // The name is derived from DATABASE_URL and validated above, and an
      // identifier cannot be parameterised, so it is quoted rather than bound.
      await admin.unsafe(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.end({ timeout: 5 });
  }
}

/** Every table, in an order that does not matter because TRUNCATE cascades. */
const TABLES = [
  "outreach_responses",
  "outreach",
  "leads",
  "technology_detections",
  "website_analysis",
  "contacts",
  "company_discovery_sources",
  "companies",
  "verification_checks",
  "discovery_run_sources",
  "discovery_runs",
  "ai_invocations",
] as const;

/**
 * Empties every table. Called between test cases so each one starts from a
 * known state without paying to recreate the schema.
 */
export async function truncateAll(database: Database): Promise<void> {
  const list = TABLES.map((table) => `"${table}"`).join(", ");
  await database.execute(sql.raw(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`));
}

export interface TestDatabase {
  readonly database: Database;
  readonly url: string;
  readonly truncate: () => Promise<void>;
  readonly close: () => Promise<void>;
}

/**
 * Creates the test database if needed, applies every migration to it, and
 * hands back a connection. Applying the real migrations rather than pushing
 * the schema is deliberate: it means the tests exercise the same SQL that will
 * be applied everywhere else, so a missing migration fails here.
 */
export async function setupTestDatabase(): Promise<TestDatabase> {
  hydrateEnvironment();

  const { DATABASE_URL } = loadDatabaseEnv();
  const { testUrl, adminUrl, databaseName } = resolveTestDatabaseUrl(DATABASE_URL);

  await ensureDatabaseExists(adminUrl, databaseName);
  await runMigrations({ url: testUrl });

  const { database, close } = createIsolatedConnection({ url: testUrl, maxConnections: 4 });

  return {
    database,
    url: testUrl,
    truncate: async () => truncateAll(database),
    close,
  };
}
