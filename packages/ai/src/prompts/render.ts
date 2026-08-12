import type { AIMessage } from "../provider/provider";
import type { RenderedPrompt } from "./prompt";

/**
 * Input delimiter. The rendered prompt wraps the caller-provided input
 * between these markers so it is visually and structurally separated from
 * the instruction text (design D5). An attacker-controlled website
 * description cannot escape this block by containing instruction-like
 * phrases — the model sees them as data, not directives.
 */
const INPUT_OPEN = "<=== INPUT BEGIN ===>";
const INPUT_CLOSE = "<=== INPUT END ===>";

/**
 * Builds a `RenderedPrompt` following the conventions in design D5:
 *
 * 1. Instructions and input occupy separate messages.
 * 2. The input is delimited — never interpolated into instruction text.
 * 3. The instruction message never references the input's content.
 *
 * Prompt authors call this from their `render` function rather than
 * constructing messages by hand, so every prompt in the registry follows
 * the same safe pattern.
 *
 * @param instructions - The system-level instructions. Must not reference
 *   the input content directly — the input block is separate.
 * @param input - The user-supplied data (company description, page text,
 *   etc.). This is attacker-controlled in the ordinary case.
 * @param toolName - The single-tool name the provider must call.
 * @param toolDescription - Human-readable description of the tool.
 * @param inputSchema - JSON Schema for the tool's input (the prompt's
 *   output schema).
 */
export function renderPrompt(
  instructions: string,
  input: string,
  toolName: string,
  toolDescription: string,
  inputSchema: Record<string, unknown>,
): RenderedPrompt {
  const messages: AIMessage[] = [
    { role: "system", content: instructions },
    {
      role: "user",
      content: [INPUT_OPEN, input, INPUT_CLOSE].join("\n"),
    },
  ];

  return {
    messages,
    tool: {
      name: toolName,
      description: toolDescription,
      inputSchema,
    },
  };
}

/**
 * Checks whether a rendered message array places input in a delimited
 * block separate from instructions. Used by tests to verify the injection
 * containment property.
 */
export function isInputConfinedToBlock(messages: readonly AIMessage[]): boolean {
  if (messages.length < 2) return false;

  const userMessage = messages.find((m) => m.role === "user");
  if (userMessage === undefined) return false;

  return userMessage.content.includes(INPUT_OPEN) && userMessage.content.includes(INPUT_CLOSE);
}
