import { describe, expect, it } from "vitest";

import { screenOutreachDraft } from "./outreach-drafting.grounding";

describe("outreach-drafting grounding", () => {
  it("rejects a draft with an uncited claim", () => {
    const result = screenOutreachDraft(
      {
        body: "Hello,",
        claims: [{ text: "We noticed your logistics expansion.", cites: ["z1"] }],
      },
      ["s1", "o1"],
    );

    expect(result.output.body).toBe("");
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.category).toBe("citation");
  });

  it("rejects a draft with prohibited content in a claim", () => {
    const result = screenOutreachDraft(
      {
        body: "Hello,",
        claims: [{ text: "We guaranteed a 20% increase.", cites: ["s1"] }],
      },
      ["s1"],
    );

    expect(result.output.body).toBe("");
    expect(result.rejections.some((r) => r.category === "promised_outcome")).toBe(true);
  });

  it("rejects a draft with prohibited content in the body", () => {
    const result = screenOutreachDraft(
      {
        body: "As discussed on our call, we guaranteed results.",
        claims: [{ text: "We can help.", cites: ["s1"] }],
      },
      ["s1"],
    );

    expect(result.output.body).toBe("");
    expect(result.rejections.some((r) => r.category === "false_relationship")).toBe(true);
    expect(result.rejections.some((r) => r.category === "promised_outcome")).toBe(true);
  });

  it("accepts a clean draft with valid citations", () => {
    const result = screenOutreachDraft(
      {
        body: "Hello, I noticed your logistics expansion.",
        claims: [{ text: "The company is expanding logistics.", cites: ["s1"] }],
      },
      ["s1"],
    );

    expect(result.output.body).toBe("Hello, I noticed your logistics expansion.");
    expect(result.rejections).toHaveLength(0);
  });

  it("rejects the whole draft when any claim is uncited — no partial salvage", () => {
    const result = screenOutreachDraft(
      {
        body: "Hello.",
        claims: [
          { text: "Good claim.", cites: ["s1"] },
          { text: "Bad claim.", cites: ["z9"] },
        ],
      },
      ["s1"],
    );

    expect(result.output.body).toBe("");
    expect(result.rejections).toHaveLength(1);
  });
});
