import { hydrateEnvironment, loadDatabaseEnv } from "@mela/config/env";

hydrateEnvironment();
const env = loadDatabaseEnv();
console.log("DATABASE_URL:", env.DATABASE_URL);
