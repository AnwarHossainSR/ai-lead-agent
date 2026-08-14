import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Unavailable } from "./data-state";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

/**
 * Spec: error and degraded state. A source that answered with an error and a
 * source that said nothing at all are different facts, and an operator reading
 * the page needs to be able to tell which one happened — so this asserts the
 * two render differently, not merely that each renders something.
 */
describe("Unavailable", () => {
  it("names a degraded source as having answered, and marks it as a warning", () => {
    render(<Unavailable title="Leads" status="degraded" error="/api/leads responded with 500." />);

    const alert = screen.getByRole("alert");

    expect(alert).toHaveAttribute("data-status", "degraded");
    expect(alert).toHaveAttribute("data-tone", "warning");
    expect(screen.getByText("Leads answered with an error")).toBeInTheDocument();
    expect(screen.getByText("/api/leads responded with 500.")).toBeInTheDocument();
  });

  it("names an unreachable source as silent, and marks it as a failure", () => {
    render(
      <Unavailable
        title="Leads"
        status="unreachable"
        error="/api/leads did not respond within 2000ms."
      />,
    );

    const alert = screen.getByRole("alert");

    expect(alert).toHaveAttribute("data-status", "unreachable");
    expect(alert).toHaveAttribute("data-tone", "danger");
    expect(screen.getByText("Leads is unreachable")).toBeInTheDocument();
  });

  it("says nothing was returned — not that the count is zero — when unreachable", () => {
    render(<Unavailable title="Leads" status="unreachable" error="Connection refused." />);

    expect(screen.getByText(/no data to show — not zero/)).toBeInTheDocument();
  });

  it("tells the reader the rest of the page is still current when only degraded", () => {
    render(<Unavailable title="Leads" status="degraded" error="Responded with 503." />);

    expect(screen.getByText(/what is shown elsewhere on this page is current/)).toBeInTheDocument();
  });

  it("offers a retry in both failure modes", () => {
    const { rerender } = render(
      <Unavailable title="Leads" status="degraded" error="Responded with 503." />,
    );

    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();

    rerender(<Unavailable title="Leads" status="unreachable" error="Connection refused." />);

    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
