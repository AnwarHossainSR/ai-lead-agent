import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ListedCompany } from "@/lib/companies";
import { CompanyListTable } from "./company-list-table";

function company(overrides: Partial<ListedCompany>): ListedCompany {
  return {
    id: "company-1",
    name: "Example Co",
    countryId: "ae",
    cityId: "dubai",
    industryId: "logistics",
    website: null,
    verificationState: "verified",
    verifiedAt: "2026-01-01T00:00:00Z",
    discoverySource: "manual",
    discoverySourceUrl: "https://example.com",
    doNotContactAt: null,
    doNotContactReason: null,
    createdAt: "2026-01-01T00:00:00Z",
    latestAnalysis: null,
    latestOpportunityAnalysis: null,
    lead: null,
    ...overrides,
  };
}

describe("CompanyListTable", () => {
  it("shows a blocked website analysis as blocked, with the failure reason as its tooltip", () => {
    render(
      <CompanyListTable
        companies={[
          company({
            latestAnalysis: {
              outcome: "blocked",
              failureReason: "Disallowed by robots.txt",
              analysedUrl: "https://example.com",
              createdAt: "2026-01-01T00:00:00Z",
            },
          }),
        ]}
      />,
    );

    const cell = screen.getByText("Blocked");
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute("title", "Disallowed by robots.txt");
  });

  it("renders unreachable distinguishably from unverified", () => {
    render(
      <CompanyListTable
        companies={[
          company({
            id: "company-unreachable",
            name: "Unreachable Co",
            verificationState: "unreachable",
          }),
          company({
            id: "company-unverified",
            name: "Unverified Co",
            verificationState: "unverified",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Unreachable")).toBeInTheDocument();
    expect(screen.getByText("Unverified")).toBeInTheDocument();
  });

  it("states the reason for a below-threshold opportunity analysis", () => {
    render(
      <CompanyListTable
        companies={[
          company({
            latestOpportunityAnalysis: {
              outcome: "below_threshold",
              reason: "No qualifying opportunities met the confidence threshold.",
              createdAt: "2026-01-01T00:00:00Z",
            },
          }),
        ]}
      />,
    );

    const cell = screen.getByText("Below Threshold");
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute(
      "title",
      "No qualifying opportunities met the confidence threshold.",
    );
  });

  it("shows an empty state rather than an empty table", () => {
    render(<CompanyListTable companies={[]} />);

    expect(screen.getByText("No companies match these filters.")).toBeInTheDocument();
  });
});
