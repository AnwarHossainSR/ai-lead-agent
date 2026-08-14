import { AUTHENTICATION_CONFIG } from "@mela/config";
import { hydrateEnvironment, loadDatabaseEnv } from "@mela/config/env";
import {
  ACCOUNT_ROLES,
  type AccountRole,
  createIsolatedConnection,
  insertAccount,
} from "@mela/database";

import { hashPassword } from "../auth/password";

/**
 * `pnpm --filter @mela/api create-account -- --email=someone@example.com --role=operator`
 *
 * The one documented way to create an account outside the operator-only API
 * endpoint (task 6.1) — there is no public sign-up. The password is read
 * from the terminal with input echo disabled and is never written to a log,
 * an error message or the process's argument list; a weak password is
 * refused before anything is hashed or stored.
 */

interface ParsedArgs {
  readonly email: string;
  readonly role: AccountRole;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string>();

  for (const arg of argv) {
    const match = /^--([a-z]+)=(.*)$/.exec(arg);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      flags.set(match[1], match[2]);
    }
  }

  const email = flags.get("email");
  const role = flags.get("role");

  if (email === undefined || email.trim().length === 0) {
    throw new Error("Usage: create-account -- --email=<address> --role=<operator|viewer>");
  }

  if (role === undefined || !isAccountRole(role)) {
    throw new Error(`Expected --role to be one of: ${ACCOUNT_ROLES.join(", ")}.`);
  }

  return { email, role };
}

function isAccountRole(value: string): value is AccountRole {
  return (ACCOUNT_ROLES as readonly string[]).includes(value);
}

const KEY_ENTER_LF = 10;
const KEY_ENTER_CR = 13;
const KEY_INTERRUPT = 3;
const KEY_BACKSPACE = 8;
const KEY_DELETE = 127;

/** Reads a line from the terminal without echoing what was typed. */
function readSecret(promptText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      reject(new Error("A password can only be entered from an interactive terminal."));
      return;
    }

    process.stdout.write(promptText);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");

    let input = "";

    const finish = (result: string | Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (result instanceof Error) {
        reject(result);
      } else {
        resolve(result);
      }
    };

    const onData = (char: string) => {
      const code = char.charCodeAt(0);

      if (code === KEY_ENTER_LF || code === KEY_ENTER_CR) {
        finish(input);
        return;
      }
      if (code === KEY_INTERRUPT) {
        finish(new Error("Cancelled."));
        return;
      }
      if (code === KEY_BACKSPACE || code === KEY_DELETE) {
        input = input.slice(0, -1);
        return;
      }
      input += char;
    };

    stdin.on("data", onData);
  });
}

async function readNewPassword(): Promise<string> {
  const password = await readSecret("Password: ");

  if (password.length < AUTHENTICATION_CONFIG.minimumPasswordLength) {
    throw new Error(
      `The password must be at least ${AUTHENTICATION_CONFIG.minimumPasswordLength} characters.`,
    );
  }

  const confirmation = await readSecret("Confirm password: ");

  if (confirmation !== password) {
    throw new Error("The password and its confirmation did not match.");
  }

  return password;
}

async function main(): Promise<void> {
  const { email, role } = parseArgs(process.argv.slice(2));

  hydrateEnvironment();
  loadDatabaseEnv();

  const password = await readNewPassword();
  const passwordHash = await hashPassword(password);

  const { database, close } = createIsolatedConnection({ maxConnections: 1 });

  try {
    const account = await insertAccount(database, { email, passwordHash, role });
    console.log(`Created ${account.role} account ${account.email} (${account.id}).`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
