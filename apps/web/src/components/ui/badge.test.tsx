import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { leadStatusTone, outreachStatusTone } from "@/lib/status-tone";
import { Badge } from "./badge";

describe("<Badge>", () => {
  it("renders its label as text, so the colour is not the only carrier", () => {
    render(<Badge tone="warning">Pending approval</Badge>);

    expect(screen.getByText("Pending approval")).toBeInTheDocument();
  });

  it("records the tone it was given rather than a colour", () => {
    render(<Badge tone={outreachStatusTone("sent")}>Sent</Badge>);

    expect(screen.getByText("Sent")).toHaveAttribute("data-tone", "success");
  });

  it("renders the same tone for the same domain value on any screen", () => {
    const { rerender } = render(<Badge tone={leadStatusTone("lost")}>Lost</Badge>);
    const first = screen.getByText("Lost").getAttribute("data-tone");

    rerender(<Badge tone={leadStatusTone("lost")}>Lost</Badge>);

    expect(first).toBe("danger");
    expect(screen.getByText("Lost")).toHaveAttribute("data-tone", "danger");
  });

  it("falls back to the neutral tone when none is given", () => {
    render(<Badge>Draft</Badge>);

    expect(screen.getByText("Draft")).toHaveAttribute("data-tone", "neutral");
  });

  it("declares no literal colour of its own", () => {
    render(<Badge tone="danger">Rejected</Badge>);

    const className = screen.getByText("Rejected").className;
    expect(className).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|oklch\(/i);
  });
});
