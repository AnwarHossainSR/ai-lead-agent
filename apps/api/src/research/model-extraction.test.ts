import { describe, it, expect, vi, beforeEach } from "vitest";

import { extractPeopleWithModel } from "./model-extraction";
import type { AIService } from "@mela/ai";

/**
 * Creates a mock AI service for testing.
 */
function createMockAIService(
  responses: Array<{ people: Array<{ name: string; role?: string; namingText: string }> }>,
): AIService {
  let callIndex = 0;

  return {
    run: vi.fn().mockImplementation(async () => {
      const response = responses[callIndex] ?? { people: [] };
      callIndex++;
      return {
        value: response,
        invocationId: `inv-${callIndex}`,
      };
    }),
  } as unknown as AIService;
}

describe("model-extraction", () => {
  describe("extractPeopleWithModel", () => {
    it("extracts people when grounding check passes", async () => {
      const mockAI = createMockAIService([
        {
          people: [
            {
              name: "John Doe",
              role: "CEO",
              namingText: "John Doe is the CEO of the company",
            },
          ],
        },
      ]);

      const pages = [
        {
          url: "https://example.com/about",
          text: "Welcome to Example Corp. John Doe is the CEO of the company.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(1);
      expect(result.people[0].name).toBe("John Doe");
      expect(result.people[0].role).toBe("CEO");
      expect(result.groundingFailures).toBe(0);
      expect(result.addressDiscards).toBe(0);
    });

    it("discards people when namingText does not appear in page", async () => {
      const mockAI = createMockAIService([
        {
          people: [
            {
              name: "John Doe",
              role: "CEO",
              namingText: "This text does not appear in the page",
            },
          ],
        },
      ]);

      const pages = [
        {
          url: "https://example.com/about",
          text: "Welcome to Example Corp.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(0);
      expect(result.groundingFailures).toBe(1);
    });

    it("discards people with email address in name field", async () => {
      const mockAI = createMockAIService([
        {
          people: [
            {
              name: "john@example.com",
              role: "CEO",
              namingText: "Contact us at john@example.com",
            },
          ],
        },
      ]);

      const pages = [
        {
          url: "https://example.com/contact",
          text: "Contact us at john@example.com for more information.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(0);
      expect(result.addressDiscards).toBe(1);
    });

    it("discards people with email address in role field", async () => {
      const mockAI = createMockAIService([
        {
          people: [
            {
              name: "John Doe",
              role: "CEO john@example.com",
              namingText: "John Doe is the CEO",
            },
          ],
        },
      ]);

      const pages = [
        {
          url: "https://example.com/about",
          text: "John Doe is the CEO of the company.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(0);
      expect(result.addressDiscards).toBe(1);
    });

    it("handles empty people array from model", async () => {
      const mockAI = createMockAIService([{ people: [] }]);

      const pages = [
        {
          url: "https://example.com/about",
          text: "Welcome to Example Corp.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(0);
      expect(result.groundingFailures).toBe(0);
      expect(result.addressDiscards).toBe(0);
    });

    it("handles multiple pages", async () => {
      const mockAI = createMockAIService([
        {
          people: [
            {
              name: "John Doe",
              role: "CEO",
              namingText: "John Doe is the CEO",
            },
          ],
        },
        {
          people: [
            {
              name: "Jane Smith",
              role: "CTO",
              namingText: "Jane Smith is the CTO",
            },
          ],
        },
      ]);

      const pages = [
        {
          url: "https://example.com/about",
          text: "John Doe is the CEO of the company.",
        },
        {
          url: "https://example.com/team",
          text: "Jane Smith is the CTO of the company.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(2);
      expect(result.people[0].name).toBe("John Doe");
      expect(result.people[1].name).toBe("Jane Smith");
    });

    it("continues when AI service throws an error", async () => {
      const mockAI = {
        run: vi.fn().mockRejectedValueOnce(new Error("AI service error")),
      } as unknown as AIService;

      const pages = [
        {
          url: "https://example.com/about",
          text: "John Doe is the CEO of the company.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(0);
      expect(result.groundingFailures).toBe(0);
    });

    it("handles case-insensitive grounding check", async () => {
      const mockAI = createMockAIService([
        {
          people: [
            {
              name: "John Doe",
              role: "CEO",
              namingText: "JOHN DOE is the CEO",
            },
          ],
        },
      ]);

      const pages = [
        {
          url: "https://example.com/about",
          text: "john doe is the CEO of the company.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(1);
      expect(result.groundingFailures).toBe(0);
    });

    it("handles empty namingText by discarding", async () => {
      const mockAI = createMockAIService([
        {
          people: [
            {
              name: "John Doe",
              role: "CEO",
              namingText: "",
            },
          ],
        },
      ]);

      const pages = [
        {
          url: "https://example.com/about",
          text: "John Doe is the CEO of the company.",
        },
      ];

      const result = await extractPeopleWithModel(mockAI, pages);

      expect(result.people).toHaveLength(0);
      expect(result.groundingFailures).toBe(1);
    });
  });
});
