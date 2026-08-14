import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CompanyDetail } from "@/lib/company-detail";
import { CompanyDetailSummary } from "./company-detail-summary";

function company(overrides: Partial<CompanyDetail> = {}): CompanyDetail {
  return {
    id: "company-1",
    name: "Example Co",
    countryId: "ae",
    cityId: "dubai",
    industryId: "logistics",
    website: null,
    verificationState: "verified",
    verifiedAt: "2026-01-01T00:00:00Z",
    discoverySource: "google_places",
    discoverySourceUrl: "https://maps.example.com/place/123",
    doNotContactAt: null,
    doNotContactReason: null,
    doNotContactByAccountId: null,
    createdAt: "2026-01-01T00:00:00Z",
    lead: null,
    ...overrides,
  };
}

describe("CompanyDetailSummary", () => {
  it("renders the discovery source URL as a link (dashboard spec: 'A company links to where it was discovered')", () => {
    render(<CompanyDetailSummary company={company()} doNotContactByEmail={null} />);

    const link = screen.getByRole("link", { name: "Google Places" });
    expect(link).toHaveAttribute("href", "https://maps.example.com/place/123");
  });

  it("shows a do-not-contact banner with its reason and who marked it (task 8.5)", () => {
    render(
      <CompanyDetailSummary
        company={company({
          doNotContactAt: "2026-01-05T00:00:00Z",
          doNotContactReason: "Unsubscribed",
          doNotContactByAccountId: "account-1",
        })}
        doNotContactByEmail="ops@example.com"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Unsubscribed");
    expect(alert).toHaveTextContent(/Marked by ops@example\.com at/);
  });

  it("shows 'Not scored' when the company has no lead", () => {
    render(<CompanyDetailSummary company={company({ lead: null })} doNotContactByEmail={null} />);

    expect(screen.getByText("Not scored")).toBeInTheDocument();
  });

  it("links to the lead when scored", () => {
    render(
      <CompanyDetailSummary
        company={company({
          lead: { id: "lead-1", status: "new", priority: "high", leadScore: 82 },
        })}
        doNotContactByEmail={null}
      />,
    );

    const link = screen.getByRole("link", { name: /82/ });
    expect(link).toHaveAttribute("href", "/leads/lead-1");
  });
});
