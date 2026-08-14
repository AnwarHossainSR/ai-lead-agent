import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Fact } from "./fact";

describe("Fact", () => {
  it("renders an observed value plainly", () => {
    render(<Fact fact={{ certainty: "observed", value: "Dubai" }} />);

    const el = screen.getByText("Dubai");
    expect(el).toHaveAttribute("data-certainty", "observed");
  });

  it("marks an inferred value distinctly from an observed one", () => {
    render(
      <Fact fact={{ certainty: "inferred", value: "Logistics", inferredFrom: "job postings" }} />,
    );

    const el = screen.getByText("Logistics");
    expect(el).toHaveAttribute("data-certainty", "inferred");
    expect(el).toHaveAttribute("title", "Inferred from job postings");
  });

  it("renders unknown as the word, not a blank, a dash or a zero", () => {
    render(<Fact fact={{ certainty: "unknown" }} />);

    expect(screen.getByText("unknown")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("does not render an unmeasured score as zero", () => {
    render(<Fact<number> fact={{ certainty: "unknown" }} format={(value) => `${value}/100`} />);

    expect(screen.getByText("unknown")).toBeInTheDocument();
    expect(screen.queryByText("0/100")).not.toBeInTheDocument();
  });

  it("renders a genuine observed zero as 0, since that is a real value", () => {
    render(
      <Fact<number> fact={{ certainty: "observed", value: 0 }} format={(value) => String(value)} />,
    );

    const el = screen.getByText("0");
    expect(el).toHaveAttribute("data-certainty", "observed");
  });

  it("presents an unknown value differently from an empty string and from a zero", () => {
    const { container } = render(
      <>
        <Fact<string> fact={{ certainty: "unknown" }} />
        <Fact<string> fact={{ certainty: "observed", value: "" }} />
        <Fact<number> fact={{ certainty: "observed", value: 0 }} />
      </>,
    );

    const facts = container.querySelectorAll("[data-slot=fact]");
    expect(facts).toHaveLength(3);

    const [unknown, empty, zero] = Array.from(facts);
    expect(unknown).toHaveTextContent("unknown");
    expect(unknown?.className).not.toBe(empty?.className);
    expect(unknown?.className).not.toBe(zero?.className);
    expect(empty).toHaveTextContent("");
  });

  it("keeps the inferred marker on the value, not only in its colour", () => {
    render(<Fact fact={{ certainty: "inferred", value: "Logistics" }} />);

    const el = screen.getByText("Logistics");
    expect(el).toHaveAttribute("aria-label", "Logistics (Inferred, not directly observed)");
    // The dotted underline and the "≈" marker survive the restyle.
    expect(el.className).toContain("decoration-dotted");
    expect(el.className).toContain("content-['≈']");
  });

  it("declares no literal colour in any of its three states", () => {
    const { container } = render(
      <>
        <Fact fact={{ certainty: "observed", value: "Dubai" }} />
        <Fact fact={{ certainty: "inferred", value: "Logistics" }} />
        <Fact<string> fact={{ certainty: "unknown" }} />
      </>,
    );

    for (const fact of container.querySelectorAll("[data-slot=fact]")) {
      expect(fact.className).not.toMatch(/#[0-9a-f]{3,8}|rgb\(|oklch\(/i);
    }
  });
});
