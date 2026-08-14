import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardSkeleton, ChartSkeleton, StatSkeleton, TableSkeleton } from "./skeleton";

describe("skeletons", () => {
  it("marks the region busy and names what is loading", () => {
    render(<TableSkeleton rows={3} columns={4} label="Loading leads" />);

    const region = screen.getByRole("status", { name: "Loading leads" });
    expect(region).toHaveAttribute("aria-busy", "true");
  });

  it("hides every placeholder shape from assistive technology", () => {
    const { container } = render(<TableSkeleton rows={2} columns={3} />);

    const shapes = container.querySelectorAll("[data-slot=skeleton]");
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shape).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("shapes the table placeholder like the table it stands in for", () => {
    const { container } = render(<TableSkeleton rows={3} columns={5} />);

    // One header row plus three body rows, five cells each.
    expect(container.querySelectorAll("[data-slot=skeleton]")).toHaveLength(5 * 4);
  });

  it("gives the card, stat and chart placeholders their own busy regions", () => {
    render(
      <>
        <CardSkeleton label="Loading summary" />
        <StatSkeleton label="Loading total" />
        <ChartSkeleton label="Loading response rate" />
      </>,
    );

    expect(screen.getByRole("status", { name: "Loading summary" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading total" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading response rate" })).toBeInTheDocument();
  });

  it("presents no placeholder as though it were data", () => {
    render(<StatSkeleton label="Loading total" />);

    expect(screen.getByRole("status", { name: "Loading total" })).toHaveTextContent("");
  });
});
