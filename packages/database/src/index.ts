/**
 * @mela/database — the schema, the connection, and the only supported way to
 * write to it.
 *
 * Reads use the exported tables directly. Writes use the helpers from
 * `./write`, which validate configuration identifiers, derive the
 * normalization keys and enforce the lifecycle rules that the database alone
 * cannot express.
 *
 * Aggregate reads — the counts, groupings and rankings behind the dashboard,
 * analytics, operations and search — live in `./read`, so the counting happens
 * in SQL rather than by pulling rows across the boundary and reducing them.
 */

export {
  closeConnection,
  createIsolatedConnection,
  getDatabase,
  pingDatabase,
  withTransaction,
  type Database,
  type DatabaseOptions,
  type Executor,
} from "./client";

export {
  assertSeedable,
  seed,
  SeedRefusedError,
  type SeedResult,
} from "./seed";

export * from "./schema";
export * from "./schemas/evidence";
export * from "./write";
export * from "./read";
export * from "./input-assembly";
