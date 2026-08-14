/**
 * @mela/database — the schema, the connection, and the only supported way to
 * write to it.
 *
 * Reads use the exported tables directly. Writes use the helpers from
 * `./write`, which validate configuration identifiers, derive the
 * normalization keys and enforce the lifecycle rules that the database alone
 * cannot express.
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
export * from "./input-assembly";
