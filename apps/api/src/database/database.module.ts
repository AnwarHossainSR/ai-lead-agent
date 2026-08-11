import { type ApiEnv } from "@mela/config/env";
import { type Database, createIsolatedConnection } from "@mela/database";
import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";

import { API_ENV } from "../config/env.module";

/** Injection token for the Drizzle client. */
export const DATABASE = "DATABASE";

/** Injection token for the pool handle. Internal — only the module closes it. */
const DATABASE_CONNECTION = "DATABASE_CONNECTION";

type Connection = ReturnType<typeof createIsolatedConnection>;

/**
 * Owns the API's connection pool.
 *
 * `createIsolatedConnection` rather than the package's shared `getDatabase()`:
 * a pool this module opened is a pool this module can close, and two test
 * modules in one process each get their own instead of racing over a global.
 *
 * The pool is lazy — `postgres` does not dial on construction — so the API
 * starts with PostgreSQL down and says so at `/health` rather than refusing to
 * boot. A database that disappears at 3am should not also prevent the restart.
 */
@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      inject: [API_ENV],
      useFactory: (env: ApiEnv): Connection => createIsolatedConnection({ url: env.DATABASE_URL }),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_CONNECTION],
      useFactory: (connection: Connection): Database => connection.database,
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_CONNECTION) private readonly connection: Connection) {}

  /** Without this the process keeps running on an open socket after shutdown. */
  async onApplicationShutdown(): Promise<void> {
    await this.connection.close();
  }
}
