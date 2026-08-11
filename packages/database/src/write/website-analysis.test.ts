import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { websiteAnalysis } from "../schema/website-analysis";
import { expectConstraintViolation } from "../testing/constraints";
import { companyInput } from "../testing/fixtures";
import { type TestDatabase, setupTestDatabase } from "../testing/harness";
import { insertCompany } from "./companies";
import { WriteValidationError } from "./errors";
import { getLatestWebsiteAnalysis, insertWebsiteAnalysis } from "./website-analysis";

let harness: TestDatabase;
let companyId: string;

const EVIDENCE = {
  detail: "Submitting the form at /contact responded with HTTP 500.",
  url: "https://example.ae/contact",
  observedAt: "2026-01-15T09:00:00.000Z",
};

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

describe("analyses over time", () => {
  it("are all retained, and the latest is the more recently created one", async () => {
    const first = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analyzedUrl: "https://example.ae",
      seoScore: 40,
    });

    const second = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analyzedUrl: "https://example.ae",
      seoScore: 70,
    });

    expect(await harness.database.select().from(websiteAnalysis)).toHaveLength(2);

    const latest = await getLatestWebsiteAnalysis(harness.database, companyId);
    expect(latest?.id).toBe(second.id);
    expect(latest?.id).not.toBe(first.id);
  });

  it("report undefined for a company that has never been analyzed", async () => {
    expect(await getLatestWebsiteAnalysis(harness.database, companyId)).toBeUndefined();
  });
});

describe("an unmeasured score", () => {
  it("is stored as unknown rather than as zero", async () => {
    const row = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analyzedUrl: "https://example.ae",
      performanceScore: 42,
    });

    expect(row.performanceScore).toBe(42);
    expect(row.accessibilityScore).toBeNull();
    expect(row.accessibilityScore).not.toBe(0);
  });

  it("is different from a measured zero", async () => {
    const row = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analyzedUrl: "https://example.ae",
      accessibilityScore: 0,
    });

    expect(row.accessibilityScore).toBe(0);
  });
});

describe("an out-of-range score", () => {
  it("is refused below zero", async () => {
    await expect(
      insertWebsiteAnalysis(harness.database, {
        companyId,
        analyzedUrl: "https://example.ae",
        seoScore: -1,
      }),
    ).rejects.toThrow(WriteValidationError);
  });

  it("is refused above one hundred", async () => {
    await expect(
      insertWebsiteAnalysis(harness.database, {
        companyId,
        analyzedUrl: "https://example.ae",
        uxScore: 101,
      }),
    ).rejects.toThrow(/at most 100/);
  });

  it("is refused by the database as well, not only by the helper", async () => {
    await expectConstraintViolation(
      harness.database.insert(websiteAnalysis).values({
        id: "019fecbb-1111-7000-8000-000000000000",
        companyId,
        analyzedUrl: "https://example.ae",
        seoScore: 250,
      }),
      "website_analysis_seo_score_range",
    );
  });
});

describe("observations", () => {
  it("carry the observed fact and the evidence supporting it", async () => {
    const row = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analyzedUrl: "https://example.ae",
      observations: [
        {
          statement: "The contact form returns a server error on submission.",
          evidence: EVIDENCE,
          certainty: "observed",
        },
      ],
    });

    expect(row.observations).toHaveLength(1);
    expect(row.observations[0]?.evidence.url).toBe("https://example.ae/contact");
    expect(row.observations[0]?.certainty).toBe("observed");
  });

  it("are refused without evidence", async () => {
    await expect(
      insertWebsiteAnalysis(harness.database, {
        companyId,
        analyzedUrl: "https://example.ae",
        observations: [{ statement: "The site feels slow.", certainty: "observed" } as never],
      }),
    ).rejects.toThrow(WriteValidationError);
  });

  it("are refused when the evidence has no URL to point at", async () => {
    await expect(
      insertWebsiteAnalysis(harness.database, {
        companyId,
        analyzedUrl: "https://example.ae",
        observations: [
          {
            statement: "The site feels slow.",
            evidence: { detail: "It felt slow.", observedAt: EVIDENCE.observedAt } as never,
            certainty: "observed",
          },
        ],
      }),
    ).rejects.toThrow(/observations\.0\.evidence\.url/);
  });

  it("are refused with a certainty that is neither observed nor inferred", async () => {
    await expect(
      insertWebsiteAnalysis(harness.database, {
        companyId,
        analyzedUrl: "https://example.ae",
        observations: [
          {
            statement: "The site is built on WordPress.",
            evidence: EVIDENCE,
            certainty: "guessed" as "observed",
          },
        ],
      }),
    ).rejects.toThrow(/observations\.0\.certainty/);
  });
});

describe("business opportunities", () => {
  it("record the impact as prose, and carry their evidence", async () => {
    const row = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analyzedUrl: "https://example.ae",
      businessOpportunities: [
        {
          statement: "Enquiries submitted through the website are not reaching the business.",
          impact: "Every enquiry made through the contact form is lost.",
          evidence: EVIDENCE,
          certainty: "inferred",
        },
      ],
    });

    expect(row.businessOpportunities[0]?.impact).toBe(
      "Every enquiry made through the contact form is lost.",
    );
  });

  it("are refused without a stated impact", async () => {
    await expect(
      insertWebsiteAnalysis(harness.database, {
        companyId,
        analyzedUrl: "https://example.ae",
        businessOpportunities: [
          {
            statement: "Their site is old.",
            evidence: EVIDENCE,
            certainty: "inferred",
          } as never,
        ],
      }),
    ).rejects.toThrow(/businessOpportunities\.0\.impact/);
  });
});

describe("detected technology", () => {
  it("is stored with its evidence, and its version may be unknown", async () => {
    const row = await insertWebsiteAnalysis(harness.database, {
      companyId,
      analyzedUrl: "https://example.ae",
      technologyStack: [
        {
          name: "jQuery",
          category: "javascript-library",
          evidence: EVIDENCE,
          certainty: "observed",
        },
      ],
    });

    expect(row.technologyStack[0]?.name).toBe("jQuery");
    expect(row.technologyStack[0]?.version).toBeUndefined();
  });
});
