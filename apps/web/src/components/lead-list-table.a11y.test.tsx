import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ListedLead } from "@/lib/leads";
import { axe } from "@/testing/axe";
import { LeadListTable } from "./lead-list-table";

const LEADS: readonly ListedLead[] = [
  {
    id: "lead-1",
    companyId: "company-1",
    companyName: "Example Logistics",
    industryId: "logistics",
    cityId: "dubai",
    leadScore: 82,
    priority: "high",
    status: "new",
    scoredAt: "2026-01-01T00:00:00Z",
    isStale: false,
  },
  {
    id: "lead-2",
    companyId: "company-2",
    companyName: "Unscored Co",
    industryId: "hospitality",
    cityId: null,
    leadScore: 41,
    priority: "low",
    status: "contacted",
    scoredAt: "2025-06-01T00:00:00Z",
    isStale: true,
  },
];

describe("LeadListTable accessibility (task 9.1)", () => {
  it("has no violations at the configured level with leads", async () => {
    const { container } = render(<LeadListTable leads={LEADS} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations in the empty state", async () => {
    const { container } = render(<LeadListTable leads={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
