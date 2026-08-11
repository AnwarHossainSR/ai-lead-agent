/**
 * Freezes a configuration value and everything reachable from it, so a
 * consumer that assigns to it fails loudly under strict mode rather than
 * silently changing the product definition for every other consumer.
 *
 * The `isFrozen` short-circuit also makes the walk safe against a value that
 * refers back to itself.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }

  return Object.freeze(value);
}
