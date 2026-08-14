import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { type Database, type Executor, withTransaction } from "./client";
import { companies } from "./schema/companies";
import {
  EXAMPLE_COMPANIES,
  EXAMPLE_DISCOVERY_RUNS,
  EXAMPLE_DISCOVERY_SOURCE,
  EXAMPLE_SOURCE_URL,
  type ExampleAnalysis,
  type ExampleCompany,
  SEED_EPOCH,
  daysBefore,
} from "./seed-data";
import { listAccounts } from "./write/accounts";
import { insertAIInvocation } from "./write/ai-invocations";
import { applyVerificationResult, insertCompany, setCompanyDoNotContact } from "./write/companies";
import { insertContact, setContactDoNotContact } from "./write/contacts";
import {
  finishDiscoveryRun,
  recordDiscoveryRunSource,
  startDiscoveryRun,
} from "./write/discovery-runs";
import { insertLeadResearchSummary } from "./write/lead-research-summaries";
import { insertLead } from "./write/leads";
import { insertOpportunity } from "./write/opportunities";
import { insertOpportunityAnalysisRun } from "./write/opportunity-analysis-runs";
import {
  approveOutreach,
  insertOutreachDraft,
  markOutreachSent,
  recordOutreachResponse,
  rejectOutreach,
  submitOutreachForApproval,
} from "./write/outreach";
import { insertTechnologyDetection } from "./write/technology-detections";
import { insertWebsiteAnalysis } from "./write/website-analysis";

/**
 * Example data for local development.
 *
 * `seed-data.ts` holds the dataset; this file writes it. Everything written
 * here is marked `is_example` where the table has that column, named
 * "Example …", and hosted under a reserved example domain, so a seeded row
 * cannot be mistaken for a researched one — in the interface, in an export, or
 * by a later phase reading the table.
 *
 * The whole seed runs in one transaction and is skipped entirely if example
 * data is already present, so running it twice leaves the counts unchanged.
 *
 * Attribution is real: approving, rejecting, sending and marking do-not-contact
 * all record which account acted, and the database has CHECK constraints that
 * refuse the row otherwise. The seed therefore needs an account to act as, and
 * says so plainly rather than writing unattributed rows.
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

const NOW_ISO = SEED_EPOCH.toISOString();

/** One AI invocation per model-authored artefact, so cost and latency are visible. */
async function recordInvocation(
  tx: Executor,
  promptName: string,
  promptVersion: number,
): Promise<string> {
  const row = await insertAIInvocation(tx, {
    promptName,
    promptVersion,
    model: "example-model",
    tier: "default",
    inputTokens: 1200 + promptVersion * 40,
    outputTokens: 320 + promptVersion * 10,
    estimatedCostUsd: 0.0042,
    latencyMs: 1800,
    attempts: 1,
    outcome: "succeeded",
  });

  return row.id;
}

async function seedVerification(
  tx: Executor,
  companyId: string,
  passed: boolean,
  website: string | null,
): Promise<void> {
  const checks = [
    {
      checkId: "website_resolves",
      status: passed ? ("passed" as const) : ("failed" as const),
      required: true,
      evidence: passed
        ? "The site responded with HTTP 200."
        : "The domain did not resolve on three attempts.",
      ...(website === null ? {} : { evidenceUrl: website }),
    },
    {
      checkId: "name_matches_site",
      status: passed ? ("passed" as const) : ("unknown" as const),
      required: false,
      evidence: passed ? "The company name appears in the site footer." : undefined,
    },
  ];

  await applyVerificationResult(tx, {
    companyId,
    verificationRunId: randomUUID(),
    checks,
    verdict: passed ? "passed" : "failed",
  });
}

async function seedAnalysis(
  tx: Executor,
  companyId: string,
  company: ExampleCompany,
  analysis: ExampleAnalysis,
): Promise<string> {
  const host = company.website ?? `https://${company.slug}.example.ae`;

  const row = await insertWebsiteAnalysis(tx, {
    companyId,
    analysedUrl: host,
    outcome: analysis.outcome,
    failureReason: analysis.failureReason ?? null,
    httpStatus: analysis.httpStatus ?? null,
    performanceScore: analysis.performanceScore,
    accessibilityScore: analysis.accessibilityScore,
    seoScore: analysis.seoScore,
    mobileScore: analysis.mobileScore,
    observations:
      analysis.observation === undefined
        ? []
        : [
            {
              statement: analysis.observation.statement,
              evidence: {
                detail: analysis.observation.detail,
                url: `${host}${analysis.observation.path}`,
                observedAt: NOW_ISO,
              },
              certainty: "observed" as const,
            },
          ],
    businessOpportunities:
      analysis.opportunity === undefined
        ? []
        : [
            {
              statement: analysis.opportunity.statement,
              impact: analysis.opportunity.impact,
              evidence: {
                detail: analysis.opportunity.detail,
                url: `${host}${analysis.opportunity.path}`,
                observedAt: NOW_ISO,
              },
              certainty: "inferred" as const,
            },
          ],
    technologyStack: analysis.technologies.map((technology) => ({
      name: technology.name,
      category: technology.category,
      ...(technology.version === undefined ? {} : { version: technology.version }),
      evidence: {
        detail: `${technology.matchedIn}: ${technology.matchedText}`,
        url: host,
        observedAt: NOW_ISO,
      },
      certainty: technology.certainty,
    })),
    summary: analysis.summary,
    isExample: true,
  });

  /**
   * Observed detections first, so an inferred one can point at the detection
   * that implied it — the database refuses an inference with no premise.
   */
  const detectionIdByTechnology = new Map<string, string>();
  const ordered = [...analysis.technologies].sort((left, right) =>
    left.certainty === right.certainty ? 0 : left.certainty === "observed" ? -1 : 1,
  );

  for (const technology of ordered) {
    const impliedBy =
      technology.impliedByTechnologyId === undefined
        ? null
        : (detectionIdByTechnology.get(technology.impliedByTechnologyId) ?? null);

    const detection = await insertTechnologyDetection(tx, {
      analysisId: row.id,
      fingerprintId: technology.id,
      technologyId: technology.id,
      category: technology.category,
      certainty: technology.certainty,
      matchedIn: technology.matchedIn,
      matchedText: technology.matchedText,
      version: technology.version ?? null,
      impliedBy,
    });

    detectionIdByTechnology.set(technology.id, detection.id);
  }

  return row.id;
}

export interface SeedResult {
  readonly seeded: boolean;
  readonly reason: string;
  readonly counts?: Readonly<SeedCounts>;
}

/**
 * Writes the whole example dataset.
 *
 * Ordered so every foreign key exists before it is referenced: discovery runs,
 * then companies, then everything hanging off a company.
 */
interface SeedCounts {
  discoveryRuns: number;
  companies: number;
  analyses: number;
  detections: number;
  contacts: number;
  opportunities: number;
  leads: number;
  summaries: number;
  outreach: number;
  responses: number;
}

async function writeExampleData(tx: Executor, actorAccountId: string): Promise<SeedCounts> {
  const counts: SeedCounts = {
    discoveryRuns: 0,
    companies: 0,
    analyses: 0,
    detections: 0,
    contacts: 0,
    opportunities: 0,
    leads: 0,
    summaries: 0,
    outreach: 0,
    responses: 0,
  };

  /* Discovery runs first — a company may point at the run that found it. */
  const runIds: string[] = [];
  for (const definition of EXAMPLE_DISCOVERY_RUNS) {
    const run = await startDiscoveryRun(tx, {
      countryId: definition.countryId,
      cityId: definition.cityId,
      industryId: definition.industryId,
      candidateLimit: 100,
      durationLimitSeconds: 300,
    });

    for (const source of definition.sources) {
      await recordDiscoveryRunSource(tx, {
        runId: run.id,
        sourceId: source.sourceId,
        outcome: source.outcome,
        returnedCount: source.returnedCount,
        storedCount: source.storedCount,
        duplicateCount: source.duplicateCount,
        rejectedCount: source.rejectedCount,
        note: source.note ?? null,
      });
    }

    await finishDiscoveryRun(tx, run.id, {
      outcome: definition.outcome,
      failureReason: definition.failureReason ?? null,
    });

    runIds.push(run.id);
    counts.discoveryRuns += 1;
  }

  for (const [index, definition] of EXAMPLE_COMPANIES.entries()) {
    const runId = runIds[index % runIds.length];

    const company = await insertCompany(tx, {
      name: definition.name,
      countryId: definition.countryId,
      cityId: definition.cityId,
      industryId: definition.industryId,
      website: definition.website,
      companySize: definition.companySize,
      description: definition.description,
      discoverySource: EXAMPLE_DISCOVERY_SOURCE,
      discoverySourceUrl: EXAMPLE_SOURCE_URL,
      discoveryRunId: runId ?? null,
      isExample: true,
    });
    counts.companies += 1;

    /* Verification: rejected companies failed it; discovered ones never ran it. */
    if (definition.stage === "rejected") {
      await seedVerification(tx, company.id, false, definition.website);
    } else if (definition.stage !== "discovered") {
      await seedVerification(tx, company.id, true, definition.website);
    }

    /* Website analysis and the technologies detected in it. */
    let analysisId: string | null = null;
    if (definition.analysis !== undefined) {
      analysisId = await seedAnalysis(tx, company.id, definition, definition.analysis);
      counts.analyses += 1;
      counts.detections += definition.analysis.technologies.length;
    }

    /* Contacts. A model-interpreted one needs the invocation that produced it. */
    const contactIds: string[] = [];
    for (const contact of definition.contacts) {
      const aiInvocationId =
        contact.extractionMethod === "model_interpretation"
          ? await recordInvocation(tx, "contact-extraction", 3)
          : null;

      const row = await insertContact(tx, {
        companyId: company.id,
        name: contact.name,
        jobTitle: contact.jobTitle,
        email: contact.email,
        phone: contact.phone,
        certainty: contact.certainty,
        extractionMethod: contact.extractionMethod,
        seniorityId: contact.jobTitle === null ? null : contact.seniorityId,
        aiInvocationId,
        researchSource: EXAMPLE_DISCOVERY_SOURCE,
        sourceUrl: definition.website ?? EXAMPLE_SOURCE_URL,
        isExample: true,
      });
      contactIds.push(row.id);
      counts.contacts += 1;

      if (contact.doNotContactReason !== undefined) {
        await setContactDoNotContact(tx, {
          contactId: row.id,
          reason: contact.doNotContactReason,
          actorAccountId,
        });
      }
    }

    /* Opportunities, and the analysis run that produced them. */
    if (definition.opportunities.length > 0 && analysisId !== null) {
      const aiInvocationId = await recordInvocation(tx, "opportunity-analysis", 4);
      const run = await insertOpportunityAnalysisRun(tx, {
        companyId: company.id,
        websiteAnalysisId: analysisId,
        promptVersion: 4,
        outcome: "opportunities",
        acceptedCount: definition.opportunities.length,
        rejectedCount: 1,
        rejections: [{ reason: "below_confidence_threshold", count: 1 }],
        aiInvocationId,
      });

      for (const opportunity of definition.opportunities) {
        await insertOpportunity(tx, {
          analysisRunId: run.id,
          companyId: company.id,
          categoryId: opportunity.categoryId,
          serviceId: opportunity.serviceId,
          title: opportunity.title,
          description: opportunity.description,
          impact: opportunity.impact,
          citedEvidence: [`${company.id}:observation:0`],
          aiInvocationId,
        });
        counts.opportunities += 1;
      }
    } else if (definition.stage === "analysed" && analysisId !== null) {
      /* Analysed, but nothing cleared the threshold — a run with no output. */
      const aiInvocationId = await recordInvocation(tx, "opportunity-analysis", 4);
      await insertOpportunityAnalysisRun(tx, {
        companyId: company.id,
        websiteAnalysisId: analysisId,
        promptVersion: 4,
        outcome: "below_threshold",
        acceptedCount: 0,
        rejectedCount: 2,
        rejections: [{ reason: "below_confidence_threshold", count: 2 }],
        aiInvocationId,
      });
    }

    if (definition.doNotContactReason !== undefined) {
      await setCompanyDoNotContact(tx, {
        companyId: company.id,
        reason: definition.doNotContactReason,
        actorAccountId,
      });
    }

    if (definition.lead === undefined) {
      continue;
    }

    const lead = await insertLead(tx, {
      companyId: company.id,
      scores: definition.lead.scores,
      scoreExplanation: definition.lead.explanation,
      recommendedServiceId: definition.lead.recommendedServiceId,
      contactReason: definition.lead.contactReason,
      isExample: true,
    });
    counts.leads += 1;

    /* A summary exists for some leads and not others — both are real states. */
    if (definition.lead.summaryHeadline !== undefined) {
      const aiInvocationId = await recordInvocation(tx, "research-summary", 2);
      await insertLeadResearchSummary(tx, {
        leadId: lead.id,
        companyId: company.id,
        sections: {
          business: [{ text: definition.lead.summaryHeadline, cites: ["observation:0"] }],
          webPresence: [
            {
              text: `Example summary. ${definition.analysis?.summary ?? "No analysis was run."}`,
              cites: ["observation:0"],
            },
          ],
          approach: [{ text: definition.lead.contactReason, cites: ["observation:0"] }],
        },
        citedFacts: ["observation:0"],
        unknownFacts: ["Annual revenue", "Current agency or supplier"],
        rejections: [{ category: "unsupported_claim", count: 1 }],
        promptVersion: 2,
        aiInvocationId,
      });
      counts.summaries += 1;
    }

    if (definition.outreach === undefined) {
      continue;
    }

    const draft = await insertOutreachDraft(tx, {
      leadId: lead.id,
      channel: definition.outreach.channel,
      messageBody: definition.outreach.body,
      citedFacts: [
        {
          text: definition.outreach.citedFact,
          citations: [
            {
              ref: "observation:0",
              detail: definition.outreach.citedFact,
              url: definition.website ?? EXAMPLE_SOURCE_URL,
              certainty: "observed" as const,
            },
          ],
        },
      ],
      notes: "Example outreach draft used for local development.",
      isExample: true,
    });
    counts.outreach += 1;

    /* Walk the record to whichever state this company is meant to be in. */
    const { stage } = definition;

    if (stage === "drafted") {
      continue;
    }

    await submitOutreachForApproval(tx, draft.id);

    if (stage === "awaiting_review") {
      continue;
    }

    if (stage === "rejected_draft") {
      await rejectOutreach(
        tx,
        draft.id,
        definition.outreach.rejectionReason ?? "Refused during review.",
        actorAccountId,
      );
      continue;
    }

    await approveOutreach(tx, draft.id, actorAccountId);

    if (stage === "approved") {
      continue;
    }

    await markOutreachSent(
      tx,
      draft.id,
      definition.outreach.channel === "email" ? "Sent by email" : "Sent as a LinkedIn message",
      actorAccountId,
    );

    if (stage === "sent") {
      continue;
    }

    if (definition.outreach.response !== undefined) {
      await recordOutreachResponse(tx, draft.id);
      counts.responses += 1;
    }
  }

  return counts;
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

    /**
     * Approving, rejecting, sending and marking do-not-contact all record the
     * account that acted, enforced by CHECK constraints. Without an account
     * there is no honest way to write those rows, so the seed says so instead
     * of quietly writing a thinner dataset.
     */
    const accounts = await listAccounts(tx);
    const actor = accounts.find(
      (account) => account.role === "operator" && account.disabledAt === null,
    );

    if (actor === undefined) {
      throw new SeedRefusedError(
        "no enabled operator account exists to attribute approvals and sends to. Run `pnpm db:seed:accounts` first, or use `pnpm db:fresh:seed`, which does both in order.",
      );
    }

    const counts = await writeExampleData(tx, actor.id);

    return {
      seeded: true,
      reason: `Example data written, attributed to ${actor.email}.`,
      counts,
    };
  });
}

export { daysBefore };
