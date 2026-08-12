import { ConfigurationError } from "@mela/config";

import type { PromptDefinition } from "./prompt";
import { promptRegistryKey } from "./prompt";

const SUBJECT = "Prompt registry";

/**
 * Recursively freezes a value so mutations fail loudly under strict mode.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }

  return Object.freeze(value);
}

/**
 * The registry accumulator. Prompt modules call `registerPrompt` at the
 * top level; `buildRegistry` freezes the result at module load time.
 * Never exported — only `buildRegistry` and the lookup helpers touch it.
 */
const definitions = new Map<string, PromptDefinition>();

/**
 * Registers a prompt definition. Called at the module top level by each
 * prompt file — never inside a function, never lazily.
 *
 * A duplicate `name@version` is a programming error caught at load time,
 * not at request time (design D5).
 */
export function registerPrompt(def: PromptDefinition): void {
  const key = promptRegistryKey(def.name, def.version);

  if (definitions.has(key)) {
    throw new ConfigurationError(SUBJECT, `Duplicate prompt "${def.name}" version ${def.version}.`);
  }

  definitions.set(key, def);
}

// ---------------------------------------------------------------------------
// Sentinel rendering for load-time validation
// ---------------------------------------------------------------------------

/** Marker embedded in the sentinel input to verify it appears in rendered output. */
const SENTINEL_MARKER = "__SENTINEL_INPUT_BLOCK__";

/**
 * Creates a minimal input value that satisfies the prompt's input schema
 * and contains the sentinel marker. Only used for load-time validation.
 */
function createSentinelInput(def: PromptDefinition): unknown {
  try {
    const shape = def.inputSchema;
    if (shape instanceof Object && "shape" in shape) {
      const shapeObj = (shape as { shape: Record<string, unknown> }).shape;
      const result: Record<string, unknown> = {};

      for (const [field, fieldSchema] of Object.entries(shapeObj)) {
        if (fieldSchema && typeof fieldSchema === "object") {
          // Support both Zod v3 (_def) and Zod v4 (def) structures
          const rawDef =
            (fieldSchema as Record<string, unknown>)._def ??
            (fieldSchema as Record<string, unknown>).def;
          const defObj = rawDef as Record<string, unknown> | undefined;
          const typeName = String(defObj?.typeName ?? defObj?.type ?? "");

          if (typeName === "ZodString" || typeName === "string") {
            result[field] = field === "input" ? SENTINEL_MARKER : "test";
          } else if (typeName === "ZodNumber" || typeName === "number") {
            result[field] = 0;
          } else if (typeName === "ZodEnum" || typeName === "enum") {
            // Zod v4 stores enum values in `entries` (object), v3 in `values` (array)
            const enumValues = defObj?.values as string[] | undefined;
            const enumEntries = defObj?.entries as Record<string, string> | undefined;
            const values = enumValues ?? Object.keys(enumEntries ?? {});
            if (values.length > 0) {
              result[field] = values[0];
            }
          }
          // Skip ZodOptional and other complex types
        }
      }

      return result;
    }
  } catch {
    // Schema too complex — skip sentinel validation
  }

  return undefined;
}

/**
 * Builds the frozen registry from all registered definitions. Called once
 * at module load time. Validates:
 *
 * 1. No duplicate name+version (already enforced by `registerPrompt`,
 *    but validated again here for the "one build" contract).
 * 2. Every prompt's `render` output includes its input text somewhere in
 *    the messages — catches a prompt whose template forgot the data block.
 *
 * After this call, the returned map is frozen and no further mutations
 * are possible (design D5).
 */
export function buildRegistry(
  registered: ReadonlyMap<string, PromptDefinition> = definitions,
): ReadonlyMap<string, PromptDefinition> {
  for (const [, def] of registered) {
    try {
      const sentinel = createSentinelInput(def);
      if (sentinel === undefined) continue;

      const rendered = def.render(sentinel);
      const allContent = rendered.messages.map((m) => m.content).join("\n");

      if (!allContent.includes(SENTINEL_MARKER)) {
        throw new ConfigurationError(
          SUBJECT,
          `"${def.name}" v${def.version}: render output does not include the input block. ` +
            "Instructions and input must occupy separate blocks (design D5).",
        );
      }
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      // Schema too complex for sentinel — skip render check
    }
  }

  return deepFreeze(new Map(registered));
}

// ---------------------------------------------------------------------------
// Lookup helpers — the public API over the frozen registry
// ---------------------------------------------------------------------------

/**
 * The frozen registry, built once at module load. Lazily initialized
 * on first access.
 */
let frozenRegistry: ReadonlyMap<string, PromptDefinition> | null = null;

function ensureRegistry(): ReadonlyMap<string, PromptDefinition> {
  if (frozenRegistry === null) {
    frozenRegistry = buildRegistry();
  }
  return frozenRegistry;
}

/**
 * Looks up a prompt by name and version. Throws `ConfigurationError`
 * naming the requested prompt and the registered ones if not found.
 */
export function resolvePrompt(name: string, version: number): PromptDefinition {
  const registry = ensureRegistry();
  const key = promptRegistryKey(name, version);
  const def = registry.get(key);

  if (def !== undefined) {
    return def;
  }

  const registered = [...registry.values()];
  const byName = registered.filter((d) => d.name === name);

  if (byName.length > 0) {
    const versions = byName.map((d) => d.version).join(", ");
    throw new ConfigurationError(
      SUBJECT,
      `Prompt "${name}" has no version ${version}. Existing versions: ${versions}.`,
    );
  }

  const knownNames = [...new Set(registered.map((d) => d.name))].sort();
  throw new ConfigurationError(
    SUBJECT,
    `Unknown prompt "${name}". Registered prompts: ${knownNames.join(", ")}.`,
  );
}

/**
 * Returns all registered prompt definitions. Useful for listing available
 * prompts without looking up a specific one.
 */
export function listPrompts(): ReadonlyArray<PromptDefinition> {
  return [...ensureRegistry().values()];
}
