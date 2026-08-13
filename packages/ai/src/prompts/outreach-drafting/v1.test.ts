import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { outputSchema, outreachDraftingInputSchema } from "./v1";

describe("outreach drafting output schema shape", () => {
  it("parses a draft with subject and body", () => {
    const parsed = outputSchema.parse({
      subject: "Website modernization for Al Madar",
      body: "I noticed your site loads slowly on mobile. We specialise in fixing that.",
      claims: [
        {
          text: "The site loads slowly on mobile.",
          cites: ["w1"],
        },
      ],
    }) satisfies z.infer<typeof outputSchema>;

    expect(parsed.subject).toBe("Website modernization for Al Madar");
    expect(parsed.body).toBeTruthy();
    expect(parsed.claims).toHaveLength(1);
  });

  it("parses a draft without a subject when the channel does not use one", () => {
    const parsed = outputSchema.parse({
      body: "Hi Ahmed, I saw your post about logistics expansion.",
      claims: [
        {
          text: "Ahmed posted about logistics expansion.",
          cites: ["c1"],
        },
      ],
    }) satisfies z.infer<typeof outputSchema>;

    expect(parsed.subject).toBeUndefined();
    expect(parsed.body).toBeTruthy();
  });

  it("rejects a body with no claims", () => {
    expect(() =>
      outputSchema.parse({
        body: "Hello,",
        claims: [],
      }),
    ).toThrow(/expected array to have >=1 items/);
  });

  it("rejects a claim with no citations", () => {
    expect(() =>
      outputSchema.parse({
        body: "Hello,",
        claims: [{ text: "We can help.", cites: [] }],
      }),
    ).toThrow(/Expected at least one citation/);
  });

  it("rejects a blank body", () => {
    expect(() =>
      outputSchema.parse({
        body: "   ",
        claims: [{ text: "Claim.", cites: ["c1"] }],
      }),
    ).toThrow(/Expected a message body/);
  });
});

describe("outreach drafting input schema shape", () => {
  it("parses a valid input", () => {
    const input = {
      channel: {
        id: "email",
        name: "Email",
        tone: "Professional and direct",
        subjectApplies: true,
        maxSubjectLength: 120,
        maxBodyLength: 2000,
      },
      summary: {
        sections: ["The company operates in logistics."],
        citedFacts: [{ ref: "s1", detail: "Operates in logistics.", url: "https://example.com" }],
      },
      opportunities: [],
      contact: {
        name: "Ahmed Al-Mansoor",
        jobTitle: "CTO",
        email: "ahmed@example.com",
      },
      services: [
        {
          id: "backend_and_api_development",
          name: "Backend and API Development",
          description: "Building services and integrations.",
        },
      ],
    };

    expect(() => outreachDraftingInputSchema.parse(input)).not.toThrow();
  });
});
