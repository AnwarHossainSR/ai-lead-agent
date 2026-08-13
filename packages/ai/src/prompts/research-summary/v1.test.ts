import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { researchSummaryOutputSchema } from "./v1";

describe("research summary output schema shape", () => {
  it("output schema contains the expected sections", () => {
    const parsed = researchSummaryOutputSchema.parse({
      business: [
        {
          text: "Operates in logistics across the UAE.",
          cites: ["c1"],
        },
      ],
      webPresence: [
        {
          text: "Website returns a 500 on the contact form.",
          cites: ["o1"],
        },
      ],
      opportunities: [
        {
          text: "Enquiry routing could recover lost leads.",
          cites: ["o1", "t1"],
        },
      ],
      people: [
        {
          text: "A contact with a UAE-based email was found.",
          cites: ["c1"],
        },
      ],
      approach: [
        {
          text: "Open with the contact form failure.",
          cites: ["o1"],
        },
      ],
    }) satisfies z.infer<typeof researchSummaryOutputSchema>;

    expect(parsed.business).toHaveLength(1);
    expect(parsed.webPresence).toHaveLength(1);
    expect(parsed.opportunities).toHaveLength(1);
    expect(parsed.people).toHaveLength(1);
    expect(parsed.approach).toHaveLength(1);
  });

  it("rejects a claim with no citations", () => {
    expect(() =>
      researchSummaryOutputSchema.parse({
        business: [
          {
            text: "Operates in logistics.",
            cites: [],
          },
        ],
        webPresence: [],
        opportunities: [],
        people: [],
        approach: [],
      }),
    ).toThrow(/Expected at least one citation/);
  });

  it("rejects an approach section with more than 3 claims", () => {
    expect(() =>
      researchSummaryOutputSchema.parse({
        business: [],
        webPresence: [],
        opportunities: [],
        people: [],
        approach: [
          { text: "One", cites: ["c1"] },
          { text: "Two", cites: ["c2"] },
          { text: "Three", cites: ["c3"] },
          { text: "Four", cites: ["c4"] },
        ],
      }),
    ).toThrow(/expected array to have <=3 items/);
  });

  it("allows empty sections when no claims can be supported", () => {
    const parsed = researchSummaryOutputSchema.parse({
      business: [],
      webPresence: [],
      opportunities: [],
      people: [],
      approach: [],
    });

    expect(parsed.business).toHaveLength(0);
    expect(parsed.approach).toHaveLength(0);
  });
});
