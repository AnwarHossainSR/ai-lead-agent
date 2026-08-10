import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Copies the repository-root `.env` into `process.env` for processes that Node
 * did not start with `--env-file`.
 *
 * Docker Compose reads the root `.env` automatically; nothing else does. The
 * API, drizzle-kit, the migration runner, the seed script and the integration
 * tests all run with their own package directory as the working directory, so
 * they need to find that one file rather than each keeping a copy.
 *
 * Values already present in the environment win — `process.loadEnvFile` does
 * not overwrite them — so a variable exported by CI or by the shell is never
 * silently replaced by a stale local file.
 *
 * Returns the path that was loaded, or `null` when no file was found. A
 * missing file is not an error: in CI the variables come from the environment
 * itself. Validation still happens in the env schemas, which is where a
 * missing variable is reported by name.
 */
export function hydrateEnvironment(startDirectory: string = process.cwd()): string | null {
  let directory = resolve(startDirectory);

  for (;;) {
    const candidate = resolve(directory, ".env");

    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return candidate;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      // Reached the filesystem root without finding one.
      return null;
    }

    directory = parent;
  }
}
