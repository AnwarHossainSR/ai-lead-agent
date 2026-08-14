import { hydrateEnvironment, loadDatabaseEnv } from "@mela/config/env";
import postgres from "postgres";

import { runMigrations } from "../migrate.js";
import { assertSeedable } from "../seed.js";

/**
 * `pnpm --filter @mela/database db:reset`
 *
 * Drops every table, type and the migration schema, then re-applies the
 * migrations. It writes no data: an empty database is the honest starting
 * point, and `db:seed` exists for anyone who wants the example dataset.
 *
 * The URL comes from `DATABASE_URL` rather than being hardcoded, and the same
 * refusal the seed uses applies — dropping every table in a database that is
 * not a local development one is the single most destructive thing in this
 * repository.
 */

async function dropAll(client: postgres.Sql): Promise<void> {
  await client.unsafe(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;

    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT typname FROM pg_type WHERE typcategory = 'E' AND typnamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;

    DROP SCHEMA IF EXISTS drizzle CASCADE;
  `);
}

async function main(): Promise<void> {
  hydrateEnvironment();

  const { DATABASE_URL } = loadDatabaseEnv();
  assertSeedable(DATABASE_URL, process.env.NODE_ENV);

  const client = postgres(DATABASE_URL, { max: 1 });

  try {
    console.log("Dropping all tables, types, and the drizzle schema...");
    await dropAll(client);
    console.log("Running migrations...");
    await runMigrations();
    console.log("Reset complete. The database is empty.");
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
