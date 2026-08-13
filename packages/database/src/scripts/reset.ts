import postgres from "postgres";

import { runMigrations } from "../migrate.js";
import { seed } from "../seed.js";

const client = postgres("postgresql://postgres:postgres@localhost:5432/mela");

async function dropAll() {
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

async function seedDatabase() {
  const { createIsolatedConnection } = await import("../client.js");
  const { database, close } = createIsolatedConnection({ maxConnections: 1 });

  try {
    const result = await seed(database);
    console.log(result.reason);
  } finally {
    await close();
  }
}

async function main() {
  console.log("Dropping all tables, types, and drizzle schema...");
  await dropAll();
  console.log("Running migrations...");
  await runMigrations();
  console.log("Seeding...");
  await seedDatabase();
  console.log("Reset complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
