import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResponseRateChart, type ResponseRateDatum } from "./response-rate-chart";

function datum(overrides: Partial<ResponseRateDatum>): ResponseRateDatum {
  return {
    label: "Logistics",
    rate: 0.42,
    sent: 50,
    responded: 21,
    unrecorded: 2,
    belowMinimum: false,
    ...overrides,
  };
}

describe("ResponseRateChart", () => {
  it("always displays sent, responded and unrecorded counts", () => {
    render(<ResponseRateChart data={[datum({ sent: 50, responded: 21, unrecorded: 2 })]} />);

    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("marks a segment below the minimum reporting sample size", () => {
    render(
      <ResponseRateChart
        data={[datum({ label: "Small Segment", rate: 0.5, sent: 3, belowMinimum: true })]}
      />,
    );

    expect(screen.getByText("small sample")).toBeInTheDocument();
  });

  it("draws no trend below the minimum, even when trend data is supplied", () => {
    render(
      <ResponseRateChart
        data={[
          datum({
            label: "Below Minimum",
            belowMinimum: true,
            trendDeltaPercentagePoints: 5,
          }),
          datum({
            label: "Above Minimum",
            belowMinimum: false,
            trendDeltaPercentagePoints: 5,
          }),
        ]}
      />,
    );

    expect(screen.getByText("small sample")).toBeInTheDocument();
    expect(screen.getByText("+5 pts")).toBeInTheDocument();
  });

  it("shows an empty state rather than an empty chart", () => {
    render(<ResponseRateChart data={[]} />);

    expect(screen.getByText("No outreach sent in this segment yet.")).toBeInTheDocument();
  });

  it("renders unknown for a null response rate instead of 0%", () => {
    render(<ResponseRateChart data={[datum({ rate: null })]} />);

    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
