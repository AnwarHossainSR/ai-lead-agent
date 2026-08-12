import { describe, expect, it } from "vitest";

// Import to trigger registration
import "./v1";

import type { z } from "zod";
import { resolvePrompt } from "../registry";
import type { peopleExtractOutputSchema } from "./v1";

const NAME = "people-extract";
const VERSION = 1;

describe("people-extract prompt", () => {
  describe("schema shape", () => {
    it("has no email field in output schema", () => {
      const def = resolvePrompt(NAME, VERSION);
      const jsonSchema = def.outputSchema.toJSONSchema() as {
        properties?: Record<string, unknown>;
      };

      // The top-level schema should not have email
      expect(jsonSchema.properties?.email).toBeUndefined();

      // Check nested person objects too
      const peopleDef = jsonSchema.properties?.people as
        | {
            items?: { properties?: Record<string, unknown> };
          }
        | undefined;
      expect(peopleDef?.items?.properties?.email).toBeUndefined();
    });

    it("has no telephone field in output schema", () => {
      const def = resolvePrompt(NAME, VERSION);
      const jsonSchema = def.outputSchema.toJSONSchema() as {
        properties?: Record<string, unknown>;
      };

      expect(jsonSchema.properties?.telephone).toBeUndefined();

      const peopleDef = jsonSchema.properties?.people as
        | {
            items?: { properties?: Record<string, unknown> };
          }
        | undefined;
      expect(peopleDef?.items?.properties?.telephone).toBeUndefined();
    });

    it("has no phone field in output schema", () => {
      const def = resolvePrompt(NAME, VERSION);
      const jsonSchema = def.outputSchema.toJSONSchema() as {
        properties?: Record<string, unknown>;
      };

      expect(jsonSchema.properties?.phone).toBeUndefined();

      const peopleDef = jsonSchema.properties?.people as
        | {
            items?: { properties?: Record<string, unknown> };
          }
        | undefined;
      expect(peopleDef?.items?.properties?.phone).toBeUndefined();
    });

    it("has no contactDetail field in output schema", () => {
      const def = resolvePrompt(NAME, VERSION);
      const jsonSchema = def.outputSchema.toJSONSchema() as {
        properties?: Record<string, unknown>;
      };

      expect(jsonSchema.properties?.contactDetail).toBeUndefined();

      const peopleDef = jsonSchema.properties?.people as
        | {
            items?: { properties?: Record<string, unknown> };
          }
        | undefined;
      expect(peopleDef?.items?.properties?.contactDetail).toBeUndefined();
    });
  });

  describe("render conventions", () => {
    it("places page text in a delimited block separate from instructions", () => {
      const def = resolvePrompt(NAME, VERSION);
      const rendered = def.render({
        input: "John Doe is the CEO. He can be reached at john@example.com",
        pageUrl: "https://example.com/team",
      });

      expect(rendered.messages).toHaveLength(2);

      const systemMsg = rendered.messages.find((m) => m.role === "system");
      const userMsg = rendered.messages.find((m) => m.role === "user");

      expect(systemMsg).toBeDefined();
      expect(userMsg).toBeDefined();

      // Instructions should not contain the page text
      expect(systemMsg!.content).not.toContain("John Doe is the CEO");

      // Input should be in the user message, delimited
      expect(userMsg!.content).toContain("<=== INPUT BEGIN ===>");
      expect(userMsg!.content).toContain("<=== INPUT END ===>");
      expect(userMsg!.content).toContain("John Doe is the CEO");
      expect(userMsg!.content).toContain("https://example.com/team");
    });

    it("produces a single tool definition", () => {
      const def = resolvePrompt(NAME, VERSION);
      const rendered = def.render({
        input: "Test page content",
        pageUrl: "https://example.com",
      });

      expect(rendered.tool.name).toBe("extract_people");
      expect(rendered.tool.description).toBeTruthy();
      expect(rendered.tool.inputSchema).toBeDefined();
    });
  });

  describe("output schema validation", () => {
    it("accepts valid output with people", () => {
      const def = resolvePrompt(NAME, VERSION);
      const result = def.outputSchema.parse({
        people: [
          {
            name: "John Doe",
            role: "CEO",
            namingText: "John Doe is the CEO",
          },
        ],
      }) as z.infer<typeof peopleExtractOutputSchema>;

      expect(result.people).toHaveLength(1);
      expect(result.people[0]!.name).toBe("John Doe");
    });

    it("accepts empty people array", () => {
      const def = resolvePrompt(NAME, VERSION);
      const result = def.outputSchema.parse({ people: [] }) as z.infer<
        typeof peopleExtractOutputSchema
      >;
      expect(result.people).toHaveLength(0);
    });

    it("accepts person without role", () => {
      const def = resolvePrompt(NAME, VERSION);
      const result = def.outputSchema.parse({
        people: [
          {
            name: "Jane Smith",
            namingText: "Jane Smith works here",
          },
        ],
      }) as z.infer<typeof peopleExtractOutputSchema>;

      expect(result.people[0]!.role).toBeUndefined();
    });
  });
});
