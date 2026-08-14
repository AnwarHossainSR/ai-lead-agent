import type { LeadStatus } from "@mela/config";
import { eq, sql } from "drizzle-orm";

import { type Database, type Executor, withTransaction } from "./client";
import { companies } from "./schema/companies";
import { leads } from "./schema/leads";
import { insertCompany } from "./write/companies";
import { insertContact } from "./write/contacts";
import { applyLeadStatusChange, insertLead } from "./write/leads";
import { insertOutreachDraft } from "./write/outreach";
import { insertWebsiteAnalysis } from "./write/website-analysis";

/**
 * Example data for local development.
 *
 * Everything written here is marked `is_example` and named "Example …", and
 * every domain is under a reserved example domain, so a seeded row cannot be
 * mistaken for a researched one — in the dashboard, in an export, or by a
 * later phase reading the table.
 *
 * The whole seed runs in one transaction and is skipped entirely if example
 * data is already present, so running it twice leaves the counts unchanged.
 */

export class SeedRefusedError extends Error {
  constructor(reason: string) {
    super(`Refusing to seed: ${reason}`);
    this.name = "SeedRefusedError";
  }
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const SEEDABLE_MODES = new Set(["development", "test"]);

/**
 * Refuses unless the target is unambiguously a development database.
 *
 * Two independent checks, because either one alone has an obvious failure
 * mode: NODE_ENV can be left at `development` while pointed anywhere, and a
 * loopback address proves nothing about intent. A deployed database is neither
 * on loopback nor reached with NODE_ENV=development, so both must hold.
 *
 * There is deliberately no override flag. Seeding a remote database is not a
 * thing this project needs to do, and a flag that permits it would eventually
 * be set.
 */
export function assertSeedable(databaseUrl: string, nodeEnv: string | undefined): void {
  if (nodeEnv === undefined || !SEEDABLE_MODES.has(nodeEnv)) {
    throw new SeedRefusedError(
      `NODE_ENV is ${nodeEnv === undefined ? "not set" : `"${nodeEnv}"`}. Seeding is permitted only when NODE_ENV is development or test.`,
    );
  }

  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new SeedRefusedError("DATABASE_URL could not be parsed.");
  }

  if (!LOOPBACK_HOSTS.has(host)) {
    throw new SeedRefusedError(
      `the database host is "${host}". Seeding is permitted only against a database on this machine.`,
    );
  }
}

const NOW = "2026-01-15T09:00:00.000Z";
const SEED_SOURCE = "seed script";
const SEED_SOURCE_URL = "https://example.com/mela-seed-data";

async function seedExampleCompanies(tx: Executor): Promise<void> {
  const modernizationCandidate = await insertCompany(tx, {
    name: "Example Trading L.L.C.",
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    website: "https://www.example.ae",
    companySize: "50-200",
    description: "Example company used for local development. Not a real business.",
    discoverySource: SEED_SOURCE,
    discoverySourceUrl: SEED_SOURCE_URL,
    isExample: true,
  });

  await insertContact(tx, {
    companyId: modernizationCandidate.id,
    name: "Example Contact",
    jobTitle: "Operations Director",
    email: "contact@example.ae",
    certainty: "observed",
    extractionMethod: "deterministic",
    researchSource: SEED_SOURCE,
    sourceUrl: SEED_SOURCE_URL,
    isExample: true,
  });

  await insertWebsiteAnalysis(tx, {
    companyId: modernizationCandidate.id,
    analysedUrl: "https://www.example.ae",
    performanceScore: 42,
    seoScore: 55,
    mobileScore: 38,
    // Accessibility is deliberately absent: an unmeasured score is unknown,
    // and the seed should show what that looks like rather than hiding it
    // behind a plausible number.
    observations: [
      {
        statement: "The contact form returns a server error on submission.",
        evidence: {
          detail: "Submitting the form at /contact responded with HTTP 500.",
          url: "https://www.example.ae/contact",
          observedAt: NOW,
        },
        certainty: "observed",
      },
    ],
    businessOpportunities: [
      {
        statement: "Enquiries submitted through the website are not reaching the business.",
        impact: "Every enquiry made through the contact form is lost.",
        evidence: {
          detail: "Submitting the form at /contact responded with HTTP 500.",
          url: "https://www.example.ae/contact",
          observedAt: NOW,
        },
        certainty: "inferred",
      },
    ],
    technologyStack: [
      {
        name: "jQuery",
        category: "javascript-library",
        version: "1.12.4",
        evidence: {
          detail: "Page source references /assets/jquery-1.12.4.min.js.",
          url: "https://www.example.ae",
          observedAt: NOW,
        },
        certainty: "observed",
      },
    ],
    summary: "Example analysis used for local development.",
    isExample: true,
  });

  const lead = await insertLead(tx, {
    companyId: modernizationCandidate.id,
    scores: {
      business_fit: 26,
      technical_opportunity: 27,
      business_opportunity: 18,
      decision_maker_found: 10,
      company_quality: 8,
    },
    scoreExplanation:
      "Example score. The contact form is broken, which is an observed failure with a direct commercial cost, and a decision maker is listed on the site.",
    recommendedServiceId: "website_modernization",
    contactReason: "Their contact form has been returning an error, so enquiries are being lost.",
    isExample: true,
  });

  await insertOutreachDraft(tx, {
    leadId: lead.id,
    channel: "email",
    messageBody:
      "Example draft. Not approved and not sent — approval is a separate, deliberate action taken by a person.",
    notes: "Example outreach draft used for local development.",
    isExample: true,
  });

  // A second company with no website at all, so the website-less path is
  // visible in local data rather than only in the tests.
  await insertCompany(tx, {
    name: "Example Hospitality Group",
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "hospitality",
    discoverySource: SEED_SOURCE,
    discoverySourceUrl: SEED_SOURCE_URL,
    isExample: true,
  });

  await seedExampleLeadSpread(tx);
}

/**
 * A spread of leads across every priority band, several lifecycle statuses and
 * both fresh and stale scores.
 *
 * One lead cannot show what the workspace looks like: every list is one row,
 * every filter matches everything, and no status colour is ever compared
 * against another. This exists so the local dashboard, the lead table and the
 * filters are exercised against something that resembles a working set — still
 * entirely example data, under example domains, marked `is_example`.
 */
const EXAMPLE_LEAD_SPREAD = [
  {
    name: "Example Freight Systems L.L.C.",
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    website: "https://freight.example.ae",
    scores: {
      business_fit: 28,
      technical_opportunity: 28,
      business_opportunity: 19,
      decision_maker_found: 10,
      company_quality: 9,
    },
    service: "custom_business_platform",
    status: "contacted",
    reason: "Their shipment tracking is a spreadsheet emailed to customers daily.",
    staleDays: 0,
  },
  {
    name: "Example Realty Partners",
    countryId: "uae",
    cityId: "abu_dhabi",
    industryId: "real_estate",
    website: "https://realty.example.ae",
    scores: {
      business_fit: 24,
      technical_opportunity: 22,
      business_opportunity: 16,
      decision_maker_found: 10,
      company_quality: 8,
    },
    service: "website_modernization",
    status: "qualified",
    reason: "Their listings site takes 11 seconds to load on a phone.",
    staleDays: 45,
  },
  {
    name: "Example Souq Online",
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "ecommerce",
    website: "https://souq.example.sa",
    scores: {
      business_fit: 22,
      technical_opportunity: 20,
      business_opportunity: 14,
      decision_maker_found: 10,
      company_quality: 8,
    },
    service: "backend_and_api_development",
    status: "replied",
    reason: "Their checkout drops the basket when a payment retry is needed.",
    staleDays: 0,
  },
  {
    name: "Example Desert Tours",
    countryId: "saudi_arabia",
    cityId: "jeddah",
    industryId: "hospitality",
    website: "https://tours.example.sa",
    scores: {
      business_fit: 18,
      technical_opportunity: 14,
      business_opportunity: 12,
      decision_maker_found: 0,
      company_quality: 6,
    },
    service: "website_modernization",
    status: "discovered",
    reason: null,
    staleDays: 90,
  },
  {
    name: "Example Advisory Services",
    countryId: "uae",
    cityId: "dubai",
    industryId: "business_services",
    website: "https://advisory.example.ae",
    scores: {
      business_fit: 20,
      technical_opportunity: 16,
      business_opportunity: 12,
      decision_maker_found: 10,
      company_quality: 7,
    },
    service: "aws_and_cloud_modernization",
    status: "won",
    reason: "Their client portal runs on a single unpatched VM.",
    staleDays: 12,
  },
  {
    name: "Example Coastal Logistics",
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    website: "https://coastal.example.ae",
    scores: {
      business_fit: 12,
      technical_opportunity: 10,
      business_opportunity: 8,
      decision_maker_found: 0,
      company_quality: 5,
    },
    service: null,
    status: "rejected",
    reason: null,
    staleDays: 30,
  },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedExampleLeadSpread(tx: Executor): Promise<void> {
  for (const example of EXAMPLE_LEAD_SPREAD) {
    const company = await insertCompany(tx, {
      name: example.name,
      countryId: example.countryId,
      cityId: example.cityId,
      industryId: example.industryId,
      website: example.website,
      description: "Example company used for local development. Not a real business.",
      discoverySource: SEED_SOURCE,
      discoverySourceUrl: SEED_SOURCE_URL,
      isExample: true,
    });

    const lead = await insertLead(tx, {
      companyId: company.id,
      scores: example.scores,
      scoreExplanation: "Example score used for local development.",
      recommendedServiceId: example.service,
      contactReason: example.reason,
      isExample: true,
    });

    // Leads enter at `discovered`; walk each one to its status through the
    // lifecycle rather than writing the column, so no seeded lead sits in a
    // state the lifecycle would not have allowed.
    for (const status of LIFECYCLE_PATHS[example.status]) {
      await applyLeadStatusChange(tx, lead.id, status);
    }

    if (example.staleDays > 0) {
      await tx
        .update(leads)
        .set({ scoredAt: new Date(Date.parse(NOW) - example.staleDays * DAY_MS) })
        .where(eq(leads.id, lead.id));
    }
  }
}

/** The legal route from `discovered` to each status the spread uses. */
const LIFECYCLE_PATHS = {
  discovered: [],
  qualified: ["verified", "analyzing", "qualified"],
  contacted: ["verified", "analyzing", "qualified", "contacted"],
  replied: ["verified", "analyzing", "qualified", "contacted", "replied"],
  won: [
    "verified",
    "analyzing",
    "qualified",
    "contacted",
    "replied",
    "interested",
    "meeting",
    "proposal",
    "won",
  ],
  rejected: ["rejected"],
} as const satisfies Record<string, readonly LeadStatus[]>;

export interface SeedResult {
  readonly seeded: boolean;
  readonly reason: string;
}

export async function seed(database: Database): Promise<SeedResult> {
  return withTransaction(database, async (tx) => {
    const [existing] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(sql`${companies.isExample} = true`);

    if (existing !== undefined && existing.count > 0) {
      return { seeded: false, reason: "Example data is already present." };
    }

    await seedExampleCompanies(tx);

    return { seeded: true, reason: "Example data written." };
  });
}
