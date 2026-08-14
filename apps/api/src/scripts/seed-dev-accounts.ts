import { hydrateEnvironment, loadDatabaseEnv } from "@mela/config/env";
import {
  type AccountRole,
  assertSeedable,
  createIsolatedConnection,
  findAccountByEmailWithHash,
  insertAccount,
} from "@mela/database";

import { hashPassword } from "../auth/password";

/**
 * `pnpm --filter @mela/api seed:accounts`
 *
 * Two fixed accounts for local development, so signing in during development
 * does not need an account to be created by hand first. The credentials are
 * deliberately obvious, and the same guard the data seed uses applies here:
 * the script refuses unless `NODE_ENV` is development or test *and* the
 * database is on this machine, so these passwords cannot reach a deployed
 * database.
 *
 * `create-account` remains the way to make a real account — it never takes a
 * password from an argument or a source file.
 */

export const DEV_ACCOUNTS: ReadonlyArray<{
  email: string;
  password: string;
  role: AccountRole;
}> = [
  { email: "dev@mela.local", password: "DevPassword123!", role: "operator" },
  { email: "viewer@mela.local", password: "DevPassword123!", role: "viewer" },
];

async function main(): Promise<void> {
  hydrateEnvironment();

  const { DATABASE_URL } = loadDatabaseEnv();
  assertSeedable(DATABASE_URL, process.env.NODE_ENV);

  const { database, close } = createIsolatedConnection({ maxConnections: 1 });

  try {
    for (const account of DEV_ACCOUNTS) {
      const existing = await findAccountByEmailWithHash(database, account.email);

      if (existing !== undefined) {
        console.log(`${account.email} already exists — left alone.`);
        continue;
      }

      const passwordHash = await hashPassword(account.password);
      const created = await insertAccount(database, {
        email: account.email,
        passwordHash,
        role: account.role,
      });

      console.log(`Created ${created.role} account ${created.email} (${account.password}).`);
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
