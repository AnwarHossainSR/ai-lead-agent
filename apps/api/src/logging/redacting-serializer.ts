import { OBSERVABILITY_CONFIG } from "@mela/config";

const MAX_DEPTH = 20;

/**
 * Walks a log payload and replaces sensitive values before writing.
 *
 * Applied at the logger, not at each call site — a caller SHALL NOT be
 * required to redact before logging, and a value passed accidentally SHALL
 * still be redacted.
 *
 * Handles errors, nested arrays and circular structures without throwing.
 */
export function redact(value: unknown, secrets?: readonly string[]): unknown {
  const secretSet = secrets ?? OBSERVABILITY_CONFIG.redaction.secretValues;
  const seen = new Set<object>();
  return walk(value, secretSet, seen, 0);
}

function walk(
  value: unknown,
  secrets: readonly string[],
  seen: Set<object>,
  depth: number,
): unknown {
  if (value === null || value === undefined) return value;

  if (depth > MAX_DEPTH) return "[Object]";

  // Error objects — extract message and stack, redact them
  if (value instanceof Error) {
    const message = redactPrimitive(value.message, secrets);
    const stack =
      value.stack !== undefined ? redactPrimitive(value.stack, secrets) : undefined;
    return { message, stack, name: value.name };
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, secrets, seen, depth + 1));
  }

  // Objects (including plain objects and non-plain objects like Dates)
  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = walkProperty(key, val, secrets, seen, depth + 1);
    }
    return result;
  }

  // Primitives
  if (typeof value === "string") {
    return redactPrimitive(value, secrets);
  }

  return value;
}

function walkProperty(
  key: string,
  value: unknown,
  secrets: readonly string[],
  seen: Set<object>,
  depth: number,
): unknown {
  const { credentialKeys } = OBSERVABILITY_CONFIG.redaction.patterns;

  // If the key is a credential holder, redact the entire value
  if (credentialKeys.test(key)) {
    return "<redacted>";
  }

  return walk(value, secrets, seen, depth);
}

function redactPrimitive(value: string, secrets: readonly string[]): string {
  let result = value;

  // 1. Redact known secret values by exact match
  for (const secret of secrets) {
    if (secret.length > 0 && result.includes(secret)) {
      result = result.replaceAll(secret, "<redacted:credential>");
    }
  }

  // 2. Redact connection strings
  const { connectionStrings, emails } = OBSERVABILITY_CONFIG.redaction.patterns;
  result = result.replaceAll(connectionStrings, "<redacted:connection-string>");

  // 3. Redact email addresses
  result = result.replaceAll(emails, "<redacted:email>");

  // 4. Truncate if too long
  const { maxLength } = OBSERVABILITY_CONFIG.redaction;
  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + "...[truncated]";
  }

  return result;
}
