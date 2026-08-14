import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { OpportunityWithEvidence } from "@/lib/lead-detail";
import { OpportunityList } from "./opportunity-list";

const OPPORTUNITY: OpportunityWithEvidence = {
  id: "opp-1",
  title: "Outdated CMS",
  description: "Runs a version several majors behind.",
  impact: "Slower delivery.",
  certainty: "inferred",
  citedEvidence: ["o1", "missing-ref"],
  resolvedEvidence: [
    { ref: "o1", detail: "Matched WordPress 5.2 in the page header.", url: "https://example.com/" },
    { ref: "missing-ref", detail: "This citation could not be resolved to its source.", url: null },
  ],
  createdAt: "2026-01-01T00:00:00Z",
};

describe("OpportunityList", () => {
  it("renders a resolved citation's source URL as a link, once opened", async () => {
    const user = userEvent.setup();
    render(<OpportunityList opportunities={[OPPORTUNITY]} />);

    await user.click(screen.getByText("Cited evidence 1"));

    const link = await screen.findByRole("link", { name: "https://example.com/" });
    expect(link).toHaveAttribute("href", "https://example.com/");
  });

  it("renders an unresolved citation as an explicit unknown, not a link", () => {
    render(<OpportunityList opportunities={[OPPORTUNITY]} />);

    expect(screen.getByText("Cited evidence 2: unknown")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Cited evidence 2/ })).not.toBeInTheDocument();
  });

  it("shows an empty state rather than an empty list", () => {
    render(<OpportunityList opportunities={[]} />);

    expect(screen.getByText("No opportunities identified.")).toBeInTheDocument();
  });
});
