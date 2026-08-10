import { z } from "zod";

import { postgresUrl } from "./fields";
import { createEnvLoader } from "./load";

/**
 * Everything that talks directly to PostgreSQL — the API's data layer, the
 * migration runner, the seed script and the integration test harness.
 */
export const databaseEnvSchema = z.object({
  DATABASE_URL: postgresUrl.describe(
    "PostgreSQL connection string for the application database. Read by the API, by drizzle-kit when generating and applying migrations, and by the seed script.",
  ),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export const loadDatabaseEnv = createEnvLoader("the database layer", databaseEnvSchema);
