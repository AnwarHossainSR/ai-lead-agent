/**
 * The integration test harness, exposed as `@mela/database/testing` so other
 * packages (notably the API) can run their own integration tests against the
 * same dedicated `_test` PostgreSQL database instead of the development one.
 */

export {
  resolveTestDatabaseUrl,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from "./harness";
