import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  Contact,
  LatestAnalysis,
  OpportunityWithEvidence,
  ResearchSummary,
  TechnologyDetection,
} from "@/lib/lead-detail";
import { axe } from "@/testing/axe";
import { ContactList } from "./contact-list";
import { OpportunityList } from "./opportunity-list";
import { ResearchSummaryView } from "./research-summary-view";
import { TechnologyList } from "./technology-list";

/**
 * Accessibility checks for the lead detail view's panels (task 9.1). Each
 * panel is checked in isolation — an async Server Component that fetches its
 * own data cannot render in jsdom (established limitation this project works
 * around by extracting the presentational half, per task 4.2) — so this
 * covers everything on the page except the fetch wrapper and static layout
 * text, which carry no interactive or assistive-technology surface of their
 * own.
 */

const CONTACT: Contact = {
  id: "contact-1",
  name: "Sara Al Mansoori",
  jobTitle: "Head of E-commerce",
  email: "sara@example.com",
  phone: null,
  certainty: "observed",
  sourceUrl: "https://example.com/team",
  researchSource: "team_page",
  createdAt: "2026-01-01T00:00:00Z",
  doNotContactAt: null,
  doNotContactReason: null,
  doNotContactByAccountId: null,
};

const OPPORTUNITY: OpportunityWithEvidence = {
  id: "opp-1",
  title: "Outdated CMS",
  description: "Runs a version several majors behind.",
  impact: "Slower delivery.",
  certainty: "inferred",
  citedEvidence: ["o1"],
  resolvedEvidence: [
    { ref: "o1", detail: "Matched WordPress 5.2 in the page header.", url: "https://example.com/" },
  ],
  createdAt: "2026-01-01T00:00:00Z",
};

const ANALYSIS: LatestAnalysis = {
  companyId: "company-1",
  outcome: "completed",
  analysedUrl: "https://example.com/",
  createdAt: "2026-01-01T00:00:00Z",
};

const DETECTION: TechnologyDetection = {
  id: "det-1",
  technologyId: "wordpress",
  category: "cms",
  certainty: "observed",
  matchedIn: "html",
  matchedText: '<meta name="generator" content="WordPress 5.2">',
  impliedBy: null,
};

const SUMMARY: ResearchSummary = {
  id: "summary-1",
  sections: {
    business: [{ text: "Runs a mid-size logistics operation in Dubai.", cites: ["o1"] }],
    webPresence: [],
    opportunities: [],
    people: [],
    approach: [],
  },
  unknownFacts: ["Annual revenue"],
  createdAt: "2026-01-01T00:00:00Z",
};

describe("Lead detail accessibility (task 9.1)", () => {
  it("ContactList has no violations", async () => {
    const { container } = render(<ContactList contacts={[CONTACT]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("OpportunityList has no violations", async () => {
    const { container } = render(<OpportunityList opportunities={[OPPORTUNITY]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("TechnologyList has no violations", async () => {
    const { container } = render(<TechnologyList detections={[DETECTION]} analysis={ANALYSIS} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ResearchSummaryView has no violations", async () => {
    const { container } = render(<ResearchSummaryView summary={SUMMARY} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
