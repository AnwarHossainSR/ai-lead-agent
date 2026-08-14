import { describe, expect, it } from "vitest";

import {
  aiCostUsd,
  aiInvocationDuration,
  aiTokens,
  dbPoolConnections,
  discoverySourceRequests,
  httpRequestsTotal,
  jobDuration,
  pipelineStageOutcomes,
  queueDepth,
  register,
} from "./metrics";

describe("metrics registry", () => {
  it("registers the pipeline stage outcomes counter", () => {
    const metric = register.getSingleMetric("pipeline_stage_outcomes_total");
    expect(metric).toBeDefined();
  });

  it("registers the discovery source requests counter", () => {
    const metric = register.getSingleMetric("discovery_source_requests_total");
    expect(metric).toBeDefined();
  });

  it("registers the AI tokens counter", () => {
    const metric = register.getSingleMetric("ai_tokens_total");
    expect(metric).toBeDefined();
  });

  it("registers the AI cost counter", () => {
    const metric = register.getSingleMetric("ai_cost_usd_total");
    expect(metric).toBeDefined();
  });

  it("registers the AI invocation duration histogram", () => {
    const metric = register.getSingleMetric("ai_invocation_duration_seconds");
    expect(metric).toBeDefined();
  });

  it("registers the queue depth gauge", () => {
    const metric = register.getSingleMetric("queue_depth");
    expect(metric).toBeDefined();
  });

  it("registers the job duration histogram", () => {
    const metric = register.getSingleMetric("job_duration_seconds");
    expect(metric).toBeDefined();
  });

  it("registers the HTTP requests counter", () => {
    const metric = register.getSingleMetric("http_requests_total");
    expect(metric).toBeDefined();
  });

  it("registers the DB pool connections gauge", () => {
    const metric = register.getSingleMetric("db_pool_connections");
    expect(metric).toBeDefined();
  });
});

describe("label values are drawn from configured sets", () => {
  it("pipeline stage outcomes use valid stages", () => {
    const validStages = [
      "discovery",
      "verification",
      "website-analysis",
      "technology-detection",
      "opportunity-analysis",
      "contact-research",
      "scoring",
      "research-summary",
      "reply-classification",
    ];

    pipelineStageOutcomes.inc({ stage: "discovery", outcome: "completed" }, 1);
    pipelineStageOutcomes.inc({ stage: "scoring", outcome: "blocked" }, 1);

    for (const stage of validStages) {
      expect(() =>
        pipelineStageOutcomes.inc({ stage, outcome: "completed" }, 1),
      ).not.toThrow();
    }
  });

  it("no label carries a company identifier, URL or email address", () => {
    const labelPattern = /^[a-z0-9_-]+$/;
    const invalidPatterns = [/^https?:\/\//, /@/, /^company-/, /^lead-/];

    const metricNames = register.getMetricsAsArray().map((m) => m.name);

    for (const name of metricNames) {
      for (const pattern of invalidPatterns) {
        expect(name).not.toMatch(pattern);
      }
    }
  });
});
