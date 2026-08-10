import { type LoggerService } from "@nestjs/common";

/**
 * Discards Nest's output for the duration of a test.
 *
 * Several tests deliberately drive a dependency into an unreachable state, and
 * Terminus logs each of those as an error. Left on, the run prints a wall of
 * red for the cases that are passing. Nothing is lost: a failure that matters
 * arrives as a thrown exception or a failed assertion, neither of which goes
 * through the logger.
 */
export const silentLogger: LoggerService = {
  log: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  debug: () => undefined,
  verbose: () => undefined,
};
