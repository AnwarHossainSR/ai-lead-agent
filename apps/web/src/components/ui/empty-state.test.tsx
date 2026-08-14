import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./empty-state";

describe("<EmptyState>", () => {
  it("says in words that there is nothing yet", () => {
    render(<EmptyState title="No leads yet" description="Leads appear once discovery runs." />);

    expect(screen.getByText("No leads yet")).toBeInTheDocument();
    expect(screen.getByText("Leads appear once discovery runs.")).toBeInTheDocument();
  });

  it("distinguishes the filtered case and offers a way to clear the filters", () => {
    render(
      <EmptyState
        variant="filtered"
        title="No leads match these filters"
        action={<button type="button">Clear filters</button>}
      />,
    );

    expect(
      screen.getByText("No leads match these filters").closest("[data-slot=empty-state]"),
    ).toHaveAttribute("data-variant", "filtered");
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("does not imply a filter is hiding something when none is applied", () => {
    render(<EmptyState title="Nothing here yet" />);

    const root = screen.getByText("Nothing here yet").closest("[data-slot=empty-state]");
    expect(root).toHaveAttribute("data-variant", "empty");
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });
});
