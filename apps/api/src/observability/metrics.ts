import { type Server, createServer } from "node:http";

import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

import { OBSERVABILITY_CONFIG } from "@mela/config";

const register = new Registry();

collectDefaultMetrics({ register });

// ---------------------------------------------------------------------------
// Pipeline stage outcomes
// ---------------------------------------------------------------------------

export const pipelineStageOutcomes = new Counter({
  name: "pipeline_stage_outcomes_total",
  help: "Total number of pipeline stage outcomes",
  labelNames: ["stage", "outcome"] as const,
  registers: [register],
});

// ---------------------------------------------------------------------------
// Discovery source requests
// ---------------------------------------------------------------------------

export const discoverySourceRequests = new Counter({
  name: "discovery_source_requests_total",
  help: "Total number of discovery source requests",
  labelNames: ["source", "outcome"] as const,
  registers: [register],
});

// ---------------------------------------------------------------------------
// AI metrics
// ---------------------------------------------------------------------------

export const aiTokens = new Counter({
  name: "ai_tokens_total",
  help: "Total number of AI tokens consumed",
  labelNames: ["prompt", "model"] as const,
  registers: [register],
});

export const aiCostUsd = new Counter({
  name: "ai_cost_usd_total",
  help: "Total estimated AI cost in USD",
  labelNames: ["prompt", "model"] as const,
  registers: [register],
});

export const aiInvocationDuration = new Histogram({
  name: "ai_invocation_duration_seconds",
  help: "Duration of AI invocations in seconds",
  labelNames: ["prompt", "model"] as const,
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

// ---------------------------------------------------------------------------
// Queue metrics
// ---------------------------------------------------------------------------

export const queueDepth = new Gauge({
  name: "queue_depth",
  help: "Current depth of the job queue",
  labelNames: ["queue", "state"] as const,
  registers: [register],
});

export const jobDuration = new Histogram({
  name: "job_duration_seconds",
  help: "Duration of background jobs in seconds",
  labelNames: ["queue", "outcome"] as const,
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

// ---------------------------------------------------------------------------
// HTTP metrics
// ---------------------------------------------------------------------------

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [register],
});

// ---------------------------------------------------------------------------
// Database pool
// ---------------------------------------------------------------------------

export const dbPoolConnections = new Gauge({
  name: "db_pool_connections",
  help: "Number of database pool connections",
  labelNames: ["state"] as const,
  registers: [register],
});

// ---------------------------------------------------------------------------
// Metrics HTTP server — serves /metrics on its own port
// ---------------------------------------------------------------------------

let metricsServer: Server | undefined;

export async function startMetricsServer(port: number): Promise<void> {
  if (!OBSERVABILITY_CONFIG.metricsEnabled) return;

  metricsServer = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/metrics") {
      res.setHeader("Content-Type", register.contentType);
      res.end(await register.metrics());
    } else {
      res.statusCode = 404;
      res.end("Not Found");
    }
  });

  return new Promise((resolve) => {
    metricsServer!.listen(port, () => resolve());
  });
}

export async function stopMetricsServer(): Promise<void> {
  if (metricsServer === undefined) return;
  return new Promise((resolve) => {
    metricsServer!.close(() => resolve());
    metricsServer = undefined;
  });
}

export { register };
