import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { LatestAnalysis, TechnologyDetection } from "@/lib/lead-detail";
import { TechnologyList } from "./technology-list";

const ANALYSIS: LatestAnalysis = {
  companyId: "company-1",
  outcome: "completed",
  analysedUrl: "https://example.com/",
  createdAt: "2026-01-01T00:00:00Z",
};

const OBSERVED: TechnologyDetection = {
  id: "det-1",
  technologyId: "wordpress",
  category: "cms",
  certainty: "observed",
  matchedIn: "html",
  matchedText: '<meta name="generator" content="WordPress 5.2">',
  impliedBy: null,
};

const INFERRED: TechnologyDetection = {
  id: "det-2",
  technologyId: "woocommerce",
  category: "ecommerce",
  certainty: "inferred",
  matchedIn: null,
  matchedText: null,
  impliedBy: "det-1",
};

describe("TechnologyList", () => {
  it("an observed detection's evidence source URL is a link, once opened", async () => {
    const user = userEvent.setup();
    render(<TechnologyList detections={[OBSERVED]} analysis={ANALYSIS} />);

    await user.click(screen.getByText("wordpress (cms)"));

    const link = await screen.findByRole("link", { name: "https://example.com/" });
    expect(link).toHaveAttribute("href", "https://example.com/");
  });

  it("an inferred detection carries the inferred marker, not the evidence link", () => {
    render(<TechnologyList detections={[INFERRED]} analysis={ANALYSIS} />);

    const inferred = screen.getByRole("button", { name: /woocommerce \(ecommerce\)/ });
    expect(inferred).toHaveAttribute("data-certainty", "inferred");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows an empty state rather than an empty list", () => {
    render(<TechnologyList detections={[]} analysis={ANALYSIS} />);

    expect(screen.getByText("No technologies detected.")).toBeInTheDocument();
  });
});
