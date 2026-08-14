import { AsyncLocalStorage } from "node:async_hooks";

export type ProcessRole = "api" | "worker";

export interface CorrelationContext {
  readonly correlationId: string;
  readonly role: ProcessRole;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Runs a callback within a correlation context. Every `getCorrelationId()`
 * call inside the callback (and inside any async work it spawns) returns
 * the same identifier.
 */
export function runWithCorrelation<T>(context: CorrelationContext, callback: () => T): T {
  return storage.run(context, callback);
}

/**
 * Returns the current correlation identifier, or `undefined` when called
 * outside a request or job context.
 */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/**
 * Returns the current process role, or `undefined` when called outside a
 * request or job context.
 */
export function getProcessRole(): ProcessRole | undefined {
  return storage.getStore()?.role;
}
