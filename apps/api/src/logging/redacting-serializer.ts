import { OBSERVABILITY_CONFIG, REDACTION_PATTERNS } from "@mela/config";

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

  if (value instanceof Error) {
    const message = redactPrimitive(value.message, secrets);
    const stack = value.stack !== undefined ? redactPrimitive(value.stack, secrets) : undefined;
    return { message, stack, name: value.name };
  }

  if (Array.isArray(value)) {
    return value.map((item) => walk(item, secrets, seen, depth + 1));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = walkProperty(key, val, secrets, seen, depth + 1);
    }
    return result;
  }

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
  if (REDACTION_PATTERNS.credentialKeys.test(key)) {
    return "<redacted>";
  }

  return walk(value, secrets, seen, depth);
}

function redactPrimitive(value: string, secrets: readonly string[]): string {
  let result = value;

  for (const secret of secrets) {
    if (secret.length > 0 && result.includes(secret)) {
      result = result.replaceAll(secret, "<redacted:credential>");
    }
  }

  result = result.replaceAll(REDACTION_PATTERNS.connectionStrings, "<redacted:connection-string>");
  result = result.replaceAll(REDACTION_PATTERNS.emails, "<redacted:email>");

  const { maxLength } = OBSERVABILITY_CONFIG.redaction;
  if (result.length > maxLength) {
    result = result.slice(0, maxLength) + "...[truncated]";
  }

  return result;
}
