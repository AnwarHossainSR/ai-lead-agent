import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Evidence } from "./evidence";

describe("Evidence", () => {
  it("shows the source URL as a link, the recorded time, and the cited text once opened", async () => {
    const user = userEvent.setup();

    render(
      <Evidence
        sourceUrl="https://example.com/careers"
        recordedAt="2026-01-15T10:00:00Z"
        detail="Hiring a senior backend engineer"
      >
        Hiring backend engineer
      </Evidence>,
    );

    await user.click(screen.getByText("Hiring backend engineer"));

    const link = await screen.findByRole("link", { name: "https://example.com/careers" });
    expect(link).toHaveAttribute("href", "https://example.com/careers");
    expect(screen.getByText("Hiring a senior backend engineer")).toBeInTheDocument();
    expect(screen.getByText("Recorded 2026-01-15 10:00 UTC")).toBeInTheDocument();
  });
});
