import { INITIAL_LEAD_STATUS, LeadStatusTransitionError } from "@mela/config";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { leads } from "../schema/leads";
import { expectConstraintViolation } from "../testing/constraints";
import { companyInput, leadInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertCompany } from "./companies";
import { DuplicateLeadError, WriteValidationError } from "./errors";
import { applyLeadStatusChange, insertLead } from "./leads";

let harness: TestDatabase;
let companyId: string;

beforeAll(async () => {
  harness = await setupTestDatabase();
});

beforeEach(async () => {
  await harness.truncate();
  const company = await insertCompany(harness.database, companyInput());
  companyId = company.id;
});

afterAll(async () => {
  await harness.close();
});

describe("a scored lead", () => {
  it("stores every component, the total, the priority and the explanation", async () => {
    const row = await insertLead(
      harness.database,
      leadInput(companyId, {
        recommendedServiceId: "website_modernization",
        contactReason: "Their contact form has been returning an error.",
      }),
    );

    expect(row.businessFitScore).toBe(25);
    expect(row.technicalOpportunityScore).toBe(25);
    expect(row.businessOpportunityScore).toBe(15);
    expect(row.decisionMakerFoundScore).toBe(10);
    expect(row.companyQualityScore).toBe(8);
    expect(row.leadScore).toBe(83);
    expect(row.priority).toBe("high");
    expect(row.scoreExplanation).toBe("Example explanation for a test fixture.");
    expect(row.recommendedServiceId).toBe("website_modernization");
  });

  it("derives the total from the components rather than accepting one", async () => {
    const row = await insertLead(
      harness.database,
      leadInput(companyId, {
        scores: {
          business_fit: 30,
          technical_opportunity: 30,
          business_opportunity: 20,
          decision_maker_found: 10,
          company_quality: 10,
        },
      }),
    );

    expect(row.leadScore).toBe(100);
    expect(row.priority).toBe("very_high");
  });

  it("starts at the configured initial status", async () => {
    const row = await insertLead(harness.database, leadInput(companyId));

    expect(row.status).toBe(INITIAL_LEAD_STATUS);
    expect(row.status).toBe("discovered");
  });
});

describe("a lead without an explanation", () => {
  it("is refused, and nothing is created", async () => {
    await expect(
      insertLead(harness.database, leadInput(companyId, { scoreExplanation: "   " })),
    ).rejects.toThrow(WriteValidationError);

    expect(await harness.database.select().from(leads)).toHaveLength(0);
  });

  it("is refused by the database as well, not only by the helper", async () => {
    await expectConstraintViolation(
      harness.database.insert(leads).values({
        id: "019fecbb-2222-7000-8000-000000000000",
        companyId,
        leadScore: 50,
        priority: "low",
        businessFitScore: 10,
        technicalOpportunityScore: 10,
        businessOpportunityScore: 10,
        decisionMakerFoundScore: 10,
        companyQualityScore: 10,
        scoreExplanation: "   ",
        status: "discovered",
        weightVersion: 1,
        scoredAt: new Date(),
      } as any),
      "leads_score_explanation_not_blank",
    );
  });
});

describe("a component score above its configured maximum", () => {
  it("is refused, naming the component, the value and the maximum", async () => {
    const attempt = insertLead(
      harness.database,
      leadInput(companyId, {
        scores: {
          business_fit: 31,
          technical_opportunity: 10,
          business_opportunity: 10,
          decision_maker_found: 5,
          company_quality: 5,
        },
      }),
    );

    await expect(attempt).rejects.toThrow(
      /Business Fit scored 31, but its configured maximum is 30/,
    );
  });

  it("is refused for a component with a small maximum", async () => {
    await expect(
      insertLead(
        harness.database,
        leadInput(companyId, {
          scores: {
            business_fit: 10,
            technical_opportunity: 10,
            business_opportunity: 10,
            decision_maker_found: 11,
            company_quality: 5,
          },
        }),
      ),
    ).rejects.toThrow(/Decision Maker Found scored 11, but its configured maximum is 10/);
  });

  it("is refused when negative", async () => {
    await expect(
      insertLead(
        harness.database,
        leadInput(companyId, {
          scores: {
            business_fit: -1,
            technical_opportunity: 10,
            business_opportunity: 10,
            decision_maker_found: 5,
            company_quality: 5,
          },
        }),
      ),
    ).rejects.toThrow(/at least 0 points/);
  });
});

describe("a second lead for the same company", () => {
  it("is refused with a uniqueness violation", async () => {
    await insertLead(harness.database, leadInput(companyId));

    await expect(insertLead(harness.database, leadInput(companyId))).rejects.toThrow(
      DuplicateLeadError,
    );

    expect(await harness.database.select().from(leads)).toHaveLength(1);
  });
});

describe("a lead recommending a service", () => {
  it("is refused when the service is not configured, naming the identifier", async () => {
    await expect(
      insertLead(harness.database, leadInput(companyId, { recommendedServiceId: "seo_retainer" })),
    ).rejects.toThrow(/Unknown service identifier "seo_retainer"/);
  });
});

describe("a status change", () => {
  it("is applied when the lifecycle permits it, and advances the update timestamp", async () => {
    const lead = await insertLead(harness.database, leadInput(companyId));
    const verified = await applyLeadStatusChange(harness.database, lead.id, "verified");
    const analyzing = await applyLeadStatusChange(harness.database, verified.id, "analyzing");

    expect(analyzing.status).toBe("analyzing");
    expect(analyzing.updatedAt.getTime()).toBeGreaterThan(lead.updatedAt.getTime());
  });

  it("is rejected when the lifecycle forbids it, and the stored status is untouched", async () => {
    const lead = await insertLead(harness.database, leadInput(companyId));

    await expect(applyLeadStatusChange(harness.database, lead.id, "won")).rejects.toThrow(
      LeadStatusTransitionError,
    );

    const [stored] = await harness.database.select().from(leads).where(eq(leads.id, lead.id));
    expect(stored?.status).toBe("discovered");
  });

  it("names the source, the target and the permitted targets when it is rejected", async () => {
    const lead = await insertLead(harness.database, leadInput(companyId));

    await expect(applyLeadStatusChange(harness.database, lead.id, "won")).rejects.toThrow(
      /discovered.*won.*verified, rejected/s,
    );
  });

  it("is rejected for a lead that does not exist", async () => {
    await expect(
      applyLeadStatusChange(harness.database, "019fecbb-3333-7000-8000-000000000000", "verified"),
    ).rejects.toThrow(/No lead record with identifier/);
  });
});
