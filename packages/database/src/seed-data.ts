/**
 * The shape of the example dataset, separated from the writing of it.
 *
 * This file decides *what* the local dataset contains; `seed.ts` decides how it
 * reaches the database. Keeping them apart means the spread — how many
 * companies sit in each verification state, how many leads land in each
 * priority band, which outreach statuses are represented — can be read and
 * changed without reading transaction handling.
 *
 * Two rules govern everything here:
 *
 * 1. **Nothing may be mistakable for researched data.** Every company is named
 *    "Example …", every domain is a subdomain of a reserved example domain, and
 *    every row that has an `is_example` column gets `true`.
 * 2. **Absence is represented, not smoothed over.** A real dataset contains
 *    companies with no website, analyses that were blocked, scores that were
 *    never measured, contacts whose email was never found, and leads nobody has
 *    written a summary for. A seed that contains only complete rows teaches the
 *    interface to look good on data it will never see.
 */

export const EXAMPLE_DISCOVERY_SOURCE = "seed script";
export const EXAMPLE_SOURCE_URL = "https://example.com/mela-seed-data";

/** Anchors every relative timestamp so a reseed produces the same spread. */
export const SEED_EPOCH = new Date("2026-02-01T09:00:00.000Z");

export function daysBefore(days: number): Date {
  return new Date(SEED_EPOCH.getTime() - days * 24 * 60 * 60 * 1000);
}

type CountryId = "uae" | "saudi_arabia";
type CityId = "dubai" | "abu_dhabi" | "riyadh" | "jeddah";
type IndustryId = "real_estate" | "logistics" | "hospitality" | "ecommerce" | "business_services";
type ServiceId =
  | "website_modernization"
  | "web_application_development"
  | "custom_business_platform"
  | "backend_and_api_development"
  | "aws_and_cloud_modernization";

/** How far down the pipeline a company has been carried. */
export type PipelineStage =
  /** Discovered, nothing else run yet. */
  | "discovered"
  /** Verification ran and rejected it. */
  | "rejected"
  /** Verified, but its site was never reachable. */
  | "unanalysable"
  /** Verified and analysed, no opportunity cleared the threshold. */
  | "analysed"
  /** Scored into a lead, no outreach drafted. */
  | "scored"
  /** A draft exists, nobody has looked at it. */
  | "drafted"
  /** Waiting on a person. */
  | "awaiting_review"
  /** A person approved it; not transmitted. */
  | "approved"
  /** Transmitted, no reply yet. */
  | "sent"
  /** Transmitted and replied to. */
  | "replied"
  /** A person read it and refused it. */
  | "rejected_draft";

export interface ExampleAnalysis {
  readonly outcome: "completed" | "partial" | "blocked" | "failed";
  readonly performanceScore: number | null;
  readonly accessibilityScore: number | null;
  readonly seoScore: number | null;
  readonly mobileScore: number | null;
  readonly failureReason?: string;
  readonly httpStatus?: number;
  readonly summary: string;
  readonly observation?: { statement: string; detail: string; path: string };
  readonly opportunity?: { statement: string; impact: string; detail: string; path: string };
  readonly technologies: ReadonlyArray<{
    id: string;
    name: string;
    category: string;
    version?: string;
    matchedIn: string;
    matchedText: string;
    certainty: "observed" | "inferred";
    /**
     * The technology whose presence implies this one. Required for an inferred
     * detection: the database refuses one that cannot say what implied it,
     * because an inference with no premise is a guess.
     */
    impliedByTechnologyId?: string;
  }>;
}

export interface ExampleContact {
  readonly name: string;
  readonly jobTitle: string | null;
  readonly seniorityId: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly certainty: "observed" | "inferred";
  readonly extractionMethod: "deterministic" | "model_interpretation";
  /** Set only for a contact who asked not to be contacted. */
  readonly doNotContactReason?: string;
}

export interface ExampleOpportunity {
  readonly categoryId: ServiceId;
  readonly serviceId: ServiceId;
  readonly title: string;
  readonly description: string;
  readonly impact: string;
}

export interface ExampleLead {
  readonly scores: {
    business_fit: number;
    technical_opportunity: number;
    business_opportunity: number;
    decision_maker_found: number;
    company_quality: number;
  };
  readonly explanation: string;
  readonly recommendedServiceId: ServiceId;
  readonly contactReason: string;
  /** Absent for a lead nobody has summarised yet — a real and common state. */
  readonly summaryHeadline?: string;
}

export interface ExampleOutreach {
  readonly channel: "email" | "linkedin";
  readonly subject: string;
  readonly body: string;
  readonly citedFact: string;
  /** Set when the draft was refused, so the refusal reason is visible in the UI. */
  readonly rejectionReason?: string;
  /** Set when a reply came back. */
  readonly response?: {
    kind: "replied" | "bounced" | "unsubscribed";
    categoryId: "interested" | "not_interested" | "unsubscribe" | "out_of_office";
    body: string;
    daysAfterSend: number;
  };
}

export interface ExampleCompany {
  readonly slug: string;
  readonly name: string;
  readonly countryId: CountryId;
  readonly cityId: CityId;
  readonly industryId: IndustryId;
  /** Null for a company with no website at all — the case most easily forgotten. */
  readonly website: string | null;
  readonly companySize: string | null;
  readonly description: string | null;
  readonly stage: PipelineStage;
  readonly discoveredDaysAgo: number;
  readonly analysis?: ExampleAnalysis;
  readonly contacts: readonly ExampleContact[];
  readonly opportunities: readonly ExampleOpportunity[];
  readonly lead?: ExampleLead;
  readonly outreach?: ExampleOutreach;
  /** Set when the whole company was marked do-not-contact. */
  readonly doNotContactReason?: string;
}

/* ------------------------------------------------------------------ */
/* Reusable fragments                                                  */
/* ------------------------------------------------------------------ */

const AGEING_STACK: ExampleAnalysis["technologies"] = [
  {
    id: "wordpress",
    name: "WordPress",
    category: "cms",
    version: "4.9.8",
    matchedIn: "html",
    matchedText: "wp-content",
    certainty: "observed",
  },
  {
    id: "jquery",
    name: "jQuery",
    category: "framework",
    version: "1.12.4",
    matchedIn: "script",
    matchedText: "jquery-1.12.4.min.js",
    certainty: "observed",
  },
  {
    id: "php",
    name: "PHP",
    category: "framework",
    matchedIn: "header",
    matchedText: "X-Powered-By: PHP/5.6",
    certainty: "inferred",
    impliedByTechnologyId: "wordpress",
  },
];

const MODERN_STACK: ExampleAnalysis["technologies"] = [
  {
    id: "react",
    name: "React",
    category: "framework",
    version: "18.2.0",
    matchedIn: "script",
    matchedText: "react-dom.production.min.js",
    certainty: "observed",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    category: "cdn",
    matchedIn: "header",
    matchedText: "server: cloudflare",
    certainty: "observed",
  },
];

const COMMERCE_STACK: ExampleAnalysis["technologies"] = [
  {
    id: "woocommerce",
    name: "WooCommerce",
    category: "ecommerce",
    version: "3.4.0",
    matchedIn: "html",
    matchedText: "woocommerce-page",
    certainty: "observed",
  },
  {
    id: "wordpress",
    name: "WordPress",
    category: "cms",
    version: "5.2.1",
    matchedIn: "meta",
    matchedText: "generator WordPress 5.2.1",
    certainty: "observed",
  },
];

function brokenFormAnalysis(): ExampleAnalysis {
  return {
    outcome: "completed",
    performanceScore: 34,
    accessibilityScore: 61,
    seoScore: 52,
    mobileScore: 29,
    summary: "Example analysis. The site loads, but the enquiry path does not complete.",
    observation: {
      statement: "The contact form returns a server error on submission.",
      detail: "Submitting the form at /contact responded with HTTP 500.",
      path: "/contact",
    },
    opportunity: {
      statement: "Enquiries submitted through the website are not reaching the business.",
      impact: "Every enquiry made through the contact form is lost.",
      detail: "Submitting the form at /contact responded with HTTP 500.",
      path: "/contact",
    },
    technologies: AGEING_STACK,
  };
}

function slowMobileAnalysis(): ExampleAnalysis {
  return {
    outcome: "completed",
    performanceScore: 21,
    // Never measured — the audit ran out of time before the accessibility pass.
    accessibilityScore: null,
    seoScore: 47,
    mobileScore: 18,
    summary: "Example analysis. The site is usable on desktop and close to unusable on mobile.",
    observation: {
      statement: "The largest contentful paint on mobile is over eleven seconds.",
      detail: "Lighthouse mobile run reported LCP of 11.4s on the home page.",
      path: "/",
    },
    opportunity: {
      statement: "Mobile visitors are likely leaving before the page becomes usable.",
      impact: "Most traffic in this market is mobile, so this affects the majority of visitors.",
      detail: "Lighthouse mobile run reported LCP of 11.4s on the home page.",
      path: "/",
    },
    technologies: AGEING_STACK,
  };
}

function checkoutAnalysis(): ExampleAnalysis {
  return {
    outcome: "completed",
    performanceScore: 44,
    accessibilityScore: 58,
    seoScore: 66,
    mobileScore: 39,
    summary: "Example analysis. Checkout is reachable but reports an expired certificate.",
    observation: {
      statement: "The checkout step is served over a certificate that expired.",
      detail: "TLS handshake at /checkout reported an expired leaf certificate.",
      path: "/checkout",
    },
    opportunity: {
      statement: "Customers reaching checkout see a browser security warning.",
      impact: "A security warning at the payment step is where a sale is most likely to be lost.",
      detail: "TLS handshake at /checkout reported an expired leaf certificate.",
      path: "/checkout",
    },
    technologies: COMMERCE_STACK,
  };
}

const BLOCKED_ANALYSIS: ExampleAnalysis = {
  outcome: "blocked",
  performanceScore: null,
  accessibilityScore: null,
  seoScore: null,
  mobileScore: null,
  failureReason: "The site returned HTTP 403 to the analyser on every attempt.",
  httpStatus: 403,
  summary: "Example analysis. Nothing was measured, so nothing is claimed.",
  technologies: [],
};

const PARTIAL_ANALYSIS: ExampleAnalysis = {
  outcome: "partial",
  performanceScore: 57,
  accessibilityScore: null,
  seoScore: 63,
  mobileScore: null,
  failureReason: "The mobile audit timed out; the desktop audit completed.",
  summary: "Example analysis. Desktop results only — the mobile pass did not finish.",
  technologies: MODERN_STACK,
};

const HEALTHY_ANALYSIS: ExampleAnalysis = {
  outcome: "completed",
  performanceScore: 88,
  accessibilityScore: 91,
  seoScore: 84,
  mobileScore: 79,
  summary: "Example analysis. Nothing here is worth contacting them about.",
  technologies: MODERN_STACK,
};

function observedContact(
  name: string,
  jobTitle: string,
  seniorityId: string,
  slug: string,
): ExampleContact {
  return {
    name,
    jobTitle,
    seniorityId,
    email: `${name.split(" ")[0]?.toLowerCase()}@${slug}.example.ae`,
    phone: null,
    certainty: "observed",
    extractionMethod: "deterministic",
  };
}

/** A person whose role was read out of prose rather than a structured page. */
function inferredContact(name: string, jobTitle: string, seniorityId: string): ExampleContact {
  return {
    name,
    jobTitle,
    seniorityId,
    email: null,
    phone: null,
    certainty: "inferred",
    extractionMethod: "model_interpretation",
  };
}

/** Someone whose name is known and whose role is not. Storing "unknown" is the point. */
function namelessRoleContact(name: string): ExampleContact {
  return {
    name,
    jobTitle: null,
    seniorityId: null,
    email: null,
    phone: null,
    certainty: "observed",
    extractionMethod: "deterministic",
  };
}

function brokenFormOpportunity(serviceId: ServiceId): ExampleOpportunity {
  return {
    categoryId: serviceId,
    serviceId,
    title: "Enquiries submitted through the website are lost",
    description:
      "The contact form returns HTTP 500 on submission, so an enquiry made through the site never reaches anyone.",
    impact: "Every enquiry made through the primary contact route is lost.",
  };
}

function mobileOpportunity(serviceId: ServiceId): ExampleOpportunity {
  return {
    categoryId: serviceId,
    serviceId,
    title: "The site is close to unusable on a phone",
    description:
      "Mobile largest-contentful-paint measured at 11.4 seconds, against a 2.5 second target.",
    impact: "Most traffic in this market is mobile, so this affects the majority of visitors.",
  };
}

function checkoutOpportunity(serviceId: ServiceId): ExampleOpportunity {
  return {
    categoryId: serviceId,
    serviceId,
    title: "Checkout warns the customer their connection is not private",
    description: "The certificate served at /checkout expired, so browsers interrupt the purchase.",
    impact: "A security warning at the payment step is where a sale is most likely to be lost.",
  };
}

/* ------------------------------------------------------------------ */
/* The dataset                                                         */
/* ------------------------------------------------------------------ */

/**
 * Every company in the example dataset.
 *
 * The spread is deliberate, not incidental — it is what makes the interface
 * exercisable without inventing data by hand:
 *
 * - all five industries and all four cities appear
 * - verification: verified, unverified and rejected are all present
 * - analysis: completed, partial, blocked, never-run and no-website-at-all
 * - leads span the full score range, so every priority band has members
 * - outreach covers draft, pending_approval, approved, sent, replied and rejected
 * - two records carry do-not-contact markers, one company-wide and one personal
 */
export const EXAMPLE_COMPANIES: readonly ExampleCompany[] = [
  /* ---------- Replied: the far end of the pipeline ---------- */
  {
    slug: "gulf-freight",
    name: "Example Gulf Freight L.L.C.",
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    website: "https://gulf-freight.example.ae",
    companySize: "50-200",
    description: "Example freight forwarder used for local development. Not a real business.",
    stage: "replied",
    discoveredDaysAgo: 61,
    analysis: brokenFormAnalysis(),
    contacts: [
      observedContact("Layla Haddad", "Operations Director", "director", "gulf-freight"),
      inferredContact("Omar Said", "Head of Technology", "director"),
    ],
    opportunities: [brokenFormOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 27,
        technical_opportunity: 26,
        business_opportunity: 19,
        decision_maker_found: 10,
        company_quality: 9,
      },
      explanation:
        "Example score. A broken enquiry form is an observed failure with a direct commercial cost, and a decision maker is named on the site.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their contact form has been returning an error, so enquiries are being lost.",
      summaryHeadline: "Freight forwarder losing every web enquiry to a broken form.",
    },
    outreach: {
      channel: "email",
      subject: "Your contact form is returning an error",
      body: "Example draft. Submitting the form at /contact returns HTTP 500, so enquiries made through the site are not reaching anyone.",
      citedFact: "Submitting the form at /contact responded with HTTP 500.",
      response: {
        kind: "replied",
        categoryId: "interested",
        body: "Example reply. Thanks for flagging this — can we speak next week?",
        daysAfterSend: 3,
      },
    },
  },
  {
    slug: "harbour-logistics",
    name: "Example Harbour Logistics",
    countryId: "saudi_arabia",
    cityId: "jeddah",
    industryId: "logistics",
    website: "https://harbour-logistics.example.sa",
    companySize: "200-500",
    description: "Example port logistics operator. Not a real business.",
    stage: "replied",
    discoveredDaysAgo: 54,
    analysis: slowMobileAnalysis(),
    contacts: [
      observedContact("Nadia Karim", "Chief Operating Officer", "c-level", "harbour-logistics"),
    ],
    opportunities: [mobileOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 25,
        technical_opportunity: 24,
        business_opportunity: 17,
        decision_maker_found: 10,
        company_quality: 9,
      },
      explanation:
        "Example score. Mobile performance is measured and poor, and the operator is large enough for it to matter.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their site takes over eleven seconds to become usable on a phone.",
      summaryHeadline: "Port operator whose site is unusable on mobile.",
    },
    outreach: {
      channel: "email",
      subject: "Eleven seconds to load on a phone",
      body: "Example draft. A Lighthouse mobile run measured largest-contentful-paint at 11.4 seconds on the home page.",
      citedFact: "Lighthouse mobile run reported LCP of 11.4s on the home page.",
      response: {
        kind: "unsubscribed",
        categoryId: "unsubscribe",
        body: "Example reply. Please remove us from your list.",
        daysAfterSend: 1,
      },
    },
  },

  /* ---------- Sent, awaiting a reply ---------- */
  {
    slug: "marina-residences",
    name: "Example Marina Residences",
    countryId: "uae",
    cityId: "dubai",
    industryId: "real_estate",
    website: "https://marina-residences.example.ae",
    companySize: "50-200",
    description: "Example residential developer. Not a real business.",
    stage: "sent",
    discoveredDaysAgo: 33,
    analysis: brokenFormAnalysis(),
    contacts: [
      observedContact("Rania Fadel", "Marketing Director", "director", "marina-residences"),
      namelessRoleContact("H. Al Mansoori"),
    ],
    opportunities: [brokenFormOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 26,
        technical_opportunity: 25,
        business_opportunity: 18,
        decision_maker_found: 8,
        company_quality: 8,
      },
      explanation: "Example score. Observed form failure on a lead-generation site.",
      recommendedServiceId: "website_modernization",
      contactReason: "Enquiries from their property listings are not reaching them.",
      summaryHeadline: "Developer whose listing enquiries never arrive.",
    },
    outreach: {
      channel: "email",
      subject: "Enquiries from your listings are not arriving",
      body: "Example draft. The enquiry form on your listing pages returns HTTP 500 on submission.",
      citedFact: "Submitting the form at /contact responded with HTTP 500.",
    },
  },
  {
    slug: "desert-rose-hotels",
    name: "Example Desert Rose Hotels",
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "hospitality",
    website: "https://desert-rose-hotels.example.sa",
    companySize: "200-500",
    description: "Example hotel group. Not a real business.",
    stage: "sent",
    discoveredDaysAgo: 28,
    analysis: slowMobileAnalysis(),
    contacts: [
      observedContact("Yusuf Amin", "Commercial Director", "director", "desert-rose-hotels"),
    ],
    opportunities: [mobileOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 24,
        technical_opportunity: 23,
        business_opportunity: 16,
        decision_maker_found: 8,
        company_quality: 8,
      },
      explanation: "Example score. Booking journey is slow on the device most guests use.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their booking pages are very slow on mobile.",
      summaryHeadline: "Hotel group with a slow mobile booking journey.",
    },
    outreach: {
      channel: "linkedin",
      subject: "Mobile booking speed",
      body: "Example draft. Your booking pages measured 11.4 seconds to become usable on mobile.",
      citedFact: "Lighthouse mobile run reported LCP of 11.4s on the home page.",
    },
  },

  /* ---------- Approved, not yet transmitted ---------- */
  {
    slug: "souk-online",
    name: "Example Souk Online",
    countryId: "uae",
    cityId: "dubai",
    industryId: "ecommerce",
    website: "https://souk-online.example.ae",
    companySize: "10-50",
    description: "Example online marketplace. Not a real business.",
    stage: "approved",
    discoveredDaysAgo: 21,
    analysis: checkoutAnalysis(),
    contacts: [observedContact("Dina Saleh", "Founder", "c-level", "souk-online")],
    opportunities: [checkoutOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 28,
        technical_opportunity: 27,
        business_opportunity: 20,
        decision_maker_found: 10,
        company_quality: 7,
      },
      explanation:
        "Example score. An expired certificate at the payment step is the most commercially costly failure in the set.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their checkout serves an expired certificate, so browsers warn the customer.",
      summaryHeadline: "Marketplace warning customers away at the payment step.",
    },
    outreach: {
      channel: "email",
      subject: "Your checkout is showing a security warning",
      body: "Example draft. The certificate served at /checkout has expired, so browsers interrupt the purchase.",
      citedFact: "TLS handshake at /checkout reported an expired leaf certificate.",
    },
  },

  /* ---------- Awaiting review: the queue the operator opens ---------- */
  {
    slug: "skyline-properties",
    name: "Example Skyline Properties",
    countryId: "uae",
    cityId: "abu_dhabi",
    industryId: "real_estate",
    website: "https://skyline-properties.example.ae",
    companySize: "50-200",
    description: "Example commercial property agency. Not a real business.",
    stage: "awaiting_review",
    discoveredDaysAgo: 14,
    analysis: brokenFormAnalysis(),
    contacts: [
      observedContact("Faisal Noor", "Managing Director", "c-level", "skyline-properties"),
    ],
    opportunities: [brokenFormOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 26,
        technical_opportunity: 24,
        business_opportunity: 18,
        decision_maker_found: 10,
        company_quality: 8,
      },
      explanation: "Example score. Observed form failure, named decision maker.",
      recommendedServiceId: "website_modernization",
      contactReason: "Enquiries submitted on their site return an error.",
      summaryHeadline: "Agency losing enquiries to a failing form.",
    },
    outreach: {
      channel: "email",
      subject: "Enquiries on your site are returning an error",
      body: "Example draft. Submitting the enquiry form at /contact responds with HTTP 500.",
      citedFact: "Submitting the form at /contact responded with HTTP 500.",
    },
  },
  {
    slug: "cedar-catering",
    name: "Example Cedar Catering",
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "hospitality",
    website: "https://cedar-catering.example.sa",
    companySize: "10-50",
    description: "Example events caterer. Not a real business.",
    stage: "awaiting_review",
    discoveredDaysAgo: 11,
    analysis: slowMobileAnalysis(),
    contacts: [
      observedContact("Mariam Habib", "Owner", "c-level", "cedar-catering"),
      inferredContact("Tariq Aziz", "Events Manager", "manager"),
    ],
    opportunities: [mobileOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 22,
        technical_opportunity: 23,
        business_opportunity: 15,
        decision_maker_found: 10,
        company_quality: 6,
      },
      explanation: "Example score. Measured mobile performance well below target.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their menu pages are very slow to load on a phone.",
      summaryHeadline: "Caterer whose menus barely load on mobile.",
    },
    outreach: {
      channel: "email",
      subject: "Your menu pages on mobile",
      body: "Example draft. A mobile audit measured 11.4 seconds before the page became usable.",
      citedFact: "Lighthouse mobile run reported LCP of 11.4s on the home page.",
    },
  },
  {
    slug: "pearl-consulting",
    name: "Example Pearl Consulting",
    countryId: "uae",
    cityId: "abu_dhabi",
    industryId: "business_services",
    website: "https://pearl-consulting.example.ae",
    companySize: "10-50",
    description: "Example management consultancy. Not a real business.",
    stage: "awaiting_review",
    discoveredDaysAgo: 9,
    analysis: checkoutAnalysis(),
    contacts: [observedContact("Salma Rahim", "Partner", "c-level", "pearl-consulting")],
    opportunities: [checkoutOpportunity("backend_and_api_development")],
    lead: {
      scores: {
        business_fit: 21,
        technical_opportunity: 22,
        business_opportunity: 16,
        decision_maker_found: 10,
        company_quality: 7,
      },
      explanation: "Example score. Certificate failure on a client-facing payment page.",
      recommendedServiceId: "backend_and_api_development",
      contactReason: "Their client portal serves an expired certificate.",
      summaryHeadline: "Consultancy with an expired certificate on its client portal.",
    },
    outreach: {
      channel: "linkedin",
      subject: "Certificate on your client portal",
      body: "Example draft. The certificate on your client portal expired, so clients see a browser warning.",
      citedFact: "TLS handshake at /checkout reported an expired leaf certificate.",
    },
  },

  /* ---------- A draft a person read and refused ---------- */
  {
    slug: "atlas-movers",
    name: "Example Atlas Movers",
    countryId: "saudi_arabia",
    cityId: "jeddah",
    industryId: "logistics",
    website: "https://atlas-movers.example.sa",
    companySize: "10-50",
    description: "Example relocation company. Not a real business.",
    stage: "rejected_draft",
    discoveredDaysAgo: 19,
    analysis: PARTIAL_ANALYSIS,
    contacts: [inferredContact("Khalid Rashed", "General Manager", "director")],
    opportunities: [],
    lead: {
      scores: {
        business_fit: 17,
        technical_opportunity: 12,
        business_opportunity: 9,
        decision_maker_found: 5,
        company_quality: 6,
      },
      explanation:
        "Example score. Only the desktop audit completed, so the evidence base is thinner than it looks.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their site scored below target on the checks that did complete.",
    },
    outreach: {
      channel: "email",
      subject: "Your website performance",
      body: "Example draft. This one leans on a partial audit and does not name a specific observed failure.",
      citedFact: "The mobile audit timed out; the desktop audit completed.",
      rejectionReason:
        "The audit was partial and the draft does not cite an observed failure — this reads as a guess.",
    },
  },

  /* ---------- Drafted, not yet submitted ---------- */
  {
    slug: "oasis-retail",
    name: "Example Oasis Retail",
    countryId: "uae",
    cityId: "dubai",
    industryId: "ecommerce",
    website: "https://oasis-retail.example.ae",
    companySize: "50-200",
    description: "Example multi-brand retailer. Not a real business.",
    stage: "drafted",
    discoveredDaysAgo: 7,
    analysis: checkoutAnalysis(),
    contacts: [observedContact("Hana Zayed", "Head of Ecommerce", "director", "oasis-retail")],
    opportunities: [checkoutOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 27,
        technical_opportunity: 26,
        business_opportunity: 19,
        decision_maker_found: 10,
        company_quality: 8,
      },
      explanation: "Example score. Expired certificate at checkout on a retail site.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their checkout certificate expired.",
      summaryHeadline: "Retailer interrupting its own checkout with a security warning.",
    },
    outreach: {
      channel: "email",
      subject: "Expired certificate at checkout",
      body: "Example draft, not yet submitted for review.",
      citedFact: "TLS handshake at /checkout reported an expired leaf certificate.",
    },
  },
  {
    slug: "falcon-facilities",
    name: "Example Falcon Facilities",
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "business_services",
    website: "https://falcon-facilities.example.sa",
    companySize: "200-500",
    description: "Example facilities management provider. Not a real business.",
    stage: "drafted",
    discoveredDaysAgo: 6,
    analysis: brokenFormAnalysis(),
    contacts: [
      observedContact("Bassem Iskandar", "Operations Manager", "manager", "falcon-facilities"),
    ],
    opportunities: [brokenFormOpportunity("custom_business_platform")],
    lead: {
      scores: {
        business_fit: 23,
        technical_opportunity: 24,
        business_opportunity: 17,
        decision_maker_found: 8,
        company_quality: 9,
      },
      explanation: "Example score. Observed form failure at a company large enough to feel it.",
      recommendedServiceId: "custom_business_platform",
      contactReason: "Service requests submitted through their site are not arriving.",
      summaryHeadline: "Facilities provider losing inbound service requests.",
    },
    outreach: {
      channel: "email",
      subject: "Service requests from your site",
      body: "Example draft, not yet submitted for review.",
      citedFact: "Submitting the form at /contact responded with HTTP 500.",
    },
  },

  /* ---------- Scored, nobody has drafted anything ---------- */
  {
    slug: "azure-tourism",
    name: "Example Azure Tourism",
    countryId: "uae",
    cityId: "dubai",
    industryId: "hospitality",
    website: "https://azure-tourism.example.ae",
    companySize: "10-50",
    description: "Example inbound tour operator. Not a real business.",
    stage: "scored",
    discoveredDaysAgo: 12,
    analysis: slowMobileAnalysis(),
    contacts: [namelessRoleContact("A. Darwish")],
    opportunities: [mobileOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 18,
        technical_opportunity: 21,
        business_opportunity: 13,
        decision_maker_found: 3,
        company_quality: 5,
      },
      explanation:
        "Example score. The technical case is clear; nobody with authority has been identified, which is what holds the score down.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their tour pages are slow on mobile.",
    },
  },
  {
    slug: "nile-textiles",
    name: "Example Nile Textiles Trading",
    countryId: "saudi_arabia",
    cityId: "jeddah",
    industryId: "ecommerce",
    website: "https://nile-textiles.example.sa",
    companySize: "10-50",
    description: "Example wholesale textiles trader. Not a real business.",
    stage: "scored",
    discoveredDaysAgo: 16,
    analysis: PARTIAL_ANALYSIS,
    contacts: [inferredContact("Sami Haroun", "Sales Lead", "lead")],
    opportunities: [],
    lead: {
      scores: {
        business_fit: 14,
        technical_opportunity: 11,
        business_opportunity: 8,
        decision_maker_found: 5,
        company_quality: 5,
      },
      explanation: "Example score. A partial audit and an inferred contact — a thin case.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their site scored below target on the checks that completed.",
    },
  },
  {
    slug: "granite-developments",
    name: "Example Granite Developments",
    countryId: "uae",
    cityId: "abu_dhabi",
    industryId: "real_estate",
    website: "https://granite-developments.example.ae",
    companySize: "500-1000",
    description: "Example large developer. Not a real business.",
    stage: "scored",
    discoveredDaysAgo: 23,
    analysis: HEALTHY_ANALYSIS,
    contacts: [
      observedContact("Aisha Kamal", "Director of Digital", "director", "granite-developments"),
    ],
    opportunities: [],
    lead: {
      scores: {
        business_fit: 12,
        technical_opportunity: 3,
        business_opportunity: 2,
        decision_maker_found: 10,
        company_quality: 10,
      },
      explanation:
        "Example score. A well-run site with a named decision maker: high quality, low opportunity. This is what a lead worth leaving alone looks like.",
      recommendedServiceId: "aws_and_cloud_modernization",
      contactReason: "Nothing observed is worth contacting them about.",
    },
  },

  /* ---------- Analysed, no opportunity cleared the threshold ---------- */
  {
    slug: "crescent-legal",
    name: "Example Crescent Legal Services",
    countryId: "uae",
    cityId: "dubai",
    industryId: "business_services",
    website: "https://crescent-legal.example.ae",
    companySize: "10-50",
    description: "Example legal services firm. Not a real business.",
    stage: "analysed",
    discoveredDaysAgo: 26,
    analysis: HEALTHY_ANALYSIS,
    contacts: [observedContact("Noor Jamal", "Managing Partner", "c-level", "crescent-legal")],
    opportunities: [],
  },
  {
    slug: "silk-road-imports",
    name: "Example Silk Road Imports",
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "logistics",
    website: "https://silk-road-imports.example.sa",
    companySize: "50-200",
    description: "Example import agent. Not a real business.",
    stage: "analysed",
    discoveredDaysAgo: 31,
    analysis: HEALTHY_ANALYSIS,
    contacts: [],
    opportunities: [],
  },

  /* ---------- Verified, but the site could not be analysed ---------- */
  {
    slug: "ironclad-security",
    name: "Example Ironclad Security Services",
    countryId: "uae",
    cityId: "abu_dhabi",
    industryId: "business_services",
    website: "https://ironclad-security.example.ae",
    companySize: "200-500",
    description: "Example security services provider. Not a real business.",
    stage: "unanalysable",
    discoveredDaysAgo: 37,
    analysis: BLOCKED_ANALYSIS,
    contacts: [],
    opportunities: [],
  },
  {
    slug: "royal-palm-resorts",
    name: "Example Royal Palm Resorts",
    countryId: "saudi_arabia",
    cityId: "jeddah",
    industryId: "hospitality",
    website: "https://royal-palm-resorts.example.sa",
    companySize: "500-1000",
    description: "Example resort group. Not a real business.",
    stage: "unanalysable",
    discoveredDaysAgo: 42,
    analysis: BLOCKED_ANALYSIS,
    contacts: [inferredContact("Leila Mansour", "Group Marketing Head", "director")],
    opportunities: [],
  },

  /* ---------- Discovered only: nothing has run yet ---------- */
  {
    slug: "coral-bay-estates",
    name: "Example Coral Bay Estates",
    countryId: "uae",
    cityId: "dubai",
    industryId: "real_estate",
    website: "https://coral-bay-estates.example.ae",
    companySize: null,
    description: null,
    stage: "discovered",
    discoveredDaysAgo: 2,
    contacts: [],
    opportunities: [],
  },
  {
    slug: "dune-couriers",
    name: "Example Dune Couriers",
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "logistics",
    website: "https://dune-couriers.example.sa",
    companySize: "10-50",
    description: null,
    stage: "discovered",
    discoveredDaysAgo: 1,
    contacts: [],
    opportunities: [],
  },
  {
    /* No website at all — the case most easily forgotten in a UI. */
    slug: "old-town-bazaar",
    name: "Example Old Town Bazaar",
    countryId: "saudi_arabia",
    cityId: "jeddah",
    industryId: "hospitality",
    website: null,
    companySize: null,
    description: "Example business with no website. Not a real business.",
    stage: "discovered",
    discoveredDaysAgo: 4,
    contacts: [],
    opportunities: [],
  },
  {
    slug: "riyadh-office-supplies",
    name: "Example Riyadh Office Supplies",
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "business_services",
    website: null,
    companySize: "10-50",
    description: "Example supplier with no web presence. Not a real business.",
    stage: "discovered",
    discoveredDaysAgo: 5,
    contacts: [],
    opportunities: [],
  },

  /* ---------- Verification rejected these ---------- */
  {
    slug: "phantom-holdings",
    name: "Example Phantom Holdings",
    countryId: "uae",
    cityId: "dubai",
    industryId: "business_services",
    website: "https://phantom-holdings.example.ae",
    companySize: null,
    description: "Example company that failed verification. Not a real business.",
    stage: "rejected",
    discoveredDaysAgo: 45,
    contacts: [],
    opportunities: [],
  },
  {
    slug: "mirage-trading",
    name: "Example Mirage Trading",
    countryId: "saudi_arabia",
    cityId: "jeddah",
    industryId: "ecommerce",
    website: "https://mirage-trading.example.sa",
    companySize: null,
    description: "Example company that failed verification. Not a real business.",
    stage: "rejected",
    discoveredDaysAgo: 47,
    contacts: [],
    opportunities: [],
  },

  /* ---------- Do-not-contact, company-wide and personal ---------- */
  {
    slug: "quiet-partners",
    name: "Example Quiet Partners",
    countryId: "uae",
    cityId: "abu_dhabi",
    industryId: "business_services",
    website: "https://quiet-partners.example.ae",
    companySize: "50-200",
    description: "Example company that asked not to be contacted. Not a real business.",
    stage: "scored",
    discoveredDaysAgo: 39,
    doNotContactReason: "They asked by email not to be contacted again.",
    analysis: brokenFormAnalysis(),
    contacts: [observedContact("Ziad Nassar", "Managing Director", "c-level", "quiet-partners")],
    opportunities: [brokenFormOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 24,
        technical_opportunity: 25,
        business_opportunity: 18,
        decision_maker_found: 10,
        company_quality: 8,
      },
      explanation:
        "Example score. The technical case is strong; the do-not-contact marker is what keeps this from being actionable.",
      recommendedServiceId: "website_modernization",
      contactReason: "Do not contact — they asked not to hear from us.",
    },
  },
  {
    slug: "amber-interiors",
    name: "Example Amber Interiors",
    countryId: "uae",
    cityId: "dubai",
    industryId: "real_estate",
    website: "https://amber-interiors.example.ae",
    companySize: "10-50",
    description: "Example interior fit-out firm. Not a real business.",
    stage: "scored",
    discoveredDaysAgo: 18,
    analysis: slowMobileAnalysis(),
    contacts: [
      {
        ...observedContact("Farah Qasim", "Design Director", "director", "amber-interiors"),
        doNotContactReason: "She replied asking to be removed personally.",
      },
      observedContact("Adel Barakat", "Commercial Manager", "manager", "amber-interiors"),
    ],
    opportunities: [mobileOpportunity("website_modernization")],
    lead: {
      scores: {
        business_fit: 20,
        technical_opportunity: 22,
        business_opportunity: 14,
        decision_maker_found: 8,
        company_quality: 6,
      },
      explanation:
        "Example score. One of the two named contacts has asked not to be contacted; the other has not.",
      recommendedServiceId: "website_modernization",
      contactReason: "Their portfolio pages are slow on mobile.",
    },
  },
];

/** Discovery runs the example companies are attributed to. */
export const EXAMPLE_DISCOVERY_RUNS: ReadonlyArray<{
  countryId: CountryId;
  cityId: CityId;
  industryId: IndustryId;
  daysAgo: number;
  outcome: "succeeded" | "failed" | "partial";
  failureReason?: string;
  sources: ReadonlyArray<{
    sourceId: "file_import" | "places" | "business_directory";
    outcome: "succeeded" | "failed" | "skipped";
    returnedCount: number;
    storedCount: number;
    duplicateCount: number;
    rejectedCount: number;
    note?: string;
  }>;
}> = [
  {
    countryId: "uae",
    cityId: "dubai",
    industryId: "logistics",
    daysAgo: 61,
    outcome: "succeeded",
    sources: [
      {
        sourceId: "file_import",
        outcome: "succeeded",
        returnedCount: 24,
        storedCount: 9,
        duplicateCount: 12,
        rejectedCount: 3,
      },
    ],
  },
  {
    countryId: "saudi_arabia",
    cityId: "riyadh",
    industryId: "hospitality",
    daysAgo: 28,
    outcome: "partial",
    sources: [
      {
        sourceId: "file_import",
        outcome: "succeeded",
        returnedCount: 18,
        storedCount: 6,
        duplicateCount: 9,
        rejectedCount: 3,
      },
      {
        sourceId: "places",
        outcome: "skipped",
        returnedCount: 0,
        storedCount: 0,
        duplicateCount: 0,
        rejectedCount: 0,
        note: "The places source is disabled in configuration.",
      },
    ],
  },
  {
    countryId: "uae",
    cityId: "abu_dhabi",
    industryId: "real_estate",
    daysAgo: 14,
    outcome: "succeeded",
    sources: [
      {
        sourceId: "file_import",
        outcome: "succeeded",
        returnedCount: 11,
        storedCount: 4,
        duplicateCount: 5,
        rejectedCount: 2,
      },
    ],
  },
  {
    countryId: "saudi_arabia",
    cityId: "jeddah",
    industryId: "ecommerce",
    daysAgo: 3,
    outcome: "failed",
    failureReason: "The import file could not be read.",
    sources: [
      {
        sourceId: "file_import",
        outcome: "failed",
        returnedCount: 0,
        storedCount: 0,
        duplicateCount: 0,
        rejectedCount: 0,
        note: "The import file could not be read.",
      },
    ],
  },
];
