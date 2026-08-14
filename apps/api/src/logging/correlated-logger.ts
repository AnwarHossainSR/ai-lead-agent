import { ConsoleLogger } from "@nestjs/common";

import { getCorrelationId, getProcessRole } from "./correlation-context";

/**
 * A `ConsoleLogger` subclass that attaches the current correlation identifier
 * and process role to every log line. No call site passes an identifier —
 * the context provides it.
 */
export class CorrelatedLogger extends ConsoleLogger {
  private prefix(): string {
    const correlationId = getCorrelationId();
    const role = getProcessRole();
    return correlationId !== undefined
      ? `[${role ?? "unknown"}] [${correlationId}]`
      : `[${role ?? "process"}]`;
  }

  override log(message: string, ...args: unknown[]): void {
    super.log(`${this.prefix()} ${message}`, ...args);
  }

  override error(message: string, ...args: unknown[]): void {
    super.error(`${this.prefix()} ${message}`, ...args);
  }

  override warn(message: string, ...args: unknown[]): void {
    super.warn(`${this.prefix()} ${message}`, ...args);
  }

  override debug(message: string, ...args: unknown[]): void {
    super.debug(`${this.prefix()} ${message}`, ...args);
  }

  override verbose(message: string, ...args: unknown[]): void {
    super.verbose(`${this.prefix()} ${message}`, ...args);
  }
}
