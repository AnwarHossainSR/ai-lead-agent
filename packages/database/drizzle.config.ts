import { hydrateEnvironment, loadDatabaseEnv } from "@mela/config/env";
import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit reads this to generate, check and apply migrations. The
 * connection string comes from the validated database environment, so a
 * malformed DATABASE_URL fails here with the same named error the application
 * would give rather than as a driver-level connection failure.
 */
hydrateEnvironment();

const env = loadDatabaseEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: env.DATABASE_URL },
  // Generated SQL is committed and reviewed, so it should read like something
  // a person wrote.
  breakpoints: true,
  strict: true,
  verbose: true,
});
