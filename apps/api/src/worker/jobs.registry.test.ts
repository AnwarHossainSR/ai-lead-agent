import { describe, expect, it } from "vitest";

import {
  JOB_DEFINITIONS,
  findJobDefinition,
  resolveJobDefinition,
  type JobName,
} from "./jobs.registry";

describe("job registry", () => {
  it("defines nine jobs", () => {
    expect(JOB_DEFINITIONS).toHaveLength(9);
  });

  it("each job references a configured queue", () => {
    for (const definition of JOB_DEFINITIONS) {
      expect(definition.queueConfig.concurrency).toBeGreaterThan(0);
    }
  });

  it("each job has a payload schema", () => {
    for (const definition of JOB_DEFINITIONS) {
      expect(definition.payloadSchema).toBeDefined();
    }
  });

  it("resolves a known job type", () => {
    const definition = resolveJobDefinition("scoring");
    expect(definition.name).toBe("scoring");
    expect(definition.queueName).toBe("scoring");
  });

  it("throws for an unknown job type", () => {
    expect(() => resolveJobDefinition("unknown")).toThrow(
      /Unknown job type "unknown"/,
    );
  });

  it("finds a known job type", () => {
    expect(findJobDefinition("discovery")?.name).toBe("discovery");
  });

  it("returns undefined for an unknown job type", () => {
    expect(findJobDefinition("unknown")).toBeUndefined();
  });
});

describe("job payload schemas", () => {
  const validPayloads: Record<JobName, unknown> = {
    discovery: {
      countryId: "uae",
      industryId: "real_estate",
      candidateLimit: 100,
      durationLimitSeconds: 300,
    },
    verification: { companyId: "company-1" },
    "website-analysis": { companyId: "company-1" },
    "technology-detection": { companyId: "company-1" },
    "opportunity-analysis": { companyId: "company-1" },
    "contact-research": { companyId: "company-1" },
    scoring: { companyId: "company-1", weightVersion: 1 },
    "research-summary": { leadId: "lead-1" },
    "reply-classification": { outreachId: "outreach-1", replyText: "yes" },
  };

  for (const definition of JOB_DEFINITIONS) {
    it(`accepts a valid payload for ${definition.name}`, () => {
      const payload = validPayloads[definition.name];
      const result = definition.payloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it(`rejects a payload missing a required field for ${definition.name}`, () => {
      const result = definition.payloadSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });
  }
});
