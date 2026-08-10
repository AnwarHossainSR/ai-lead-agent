import { runMigrations } from "../migrate";

/**
 * `pnpm --filter @mela/database db:migrate`
 *
 * Applies the committed migrations to the database named by DATABASE_URL.
 * Prints no connection string: a failure here is reported by drizzle with the
 * failing statement, and the URL carries a password.
 */
async function main(): Promise<void> {
  await runMigrations();
  console.log("Migrations applied.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
