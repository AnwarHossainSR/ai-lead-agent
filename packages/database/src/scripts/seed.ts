import { hydrateEnvironment, loadDatabaseEnv } from "@mela/config/env";

import { createIsolatedConnection } from "../client";
import { assertSeedable, seed } from "../seed";

/**
 * `pnpm --filter @mela/database db:seed`
 *
 * Writes the example dataset, or refuses. The refusal happens before any
 * connection is opened, so a misdirected seed never touches the database it
 * was aimed at.
 */
async function main(): Promise<void> {
  hydrateEnvironment();

  const { DATABASE_URL } = loadDatabaseEnv();
  assertSeedable(DATABASE_URL, process.env.NODE_ENV);

  const { database, close } = createIsolatedConnection({ maxConnections: 1 });

  try {
    const result = await seed(database);
    console.log(result.reason);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
