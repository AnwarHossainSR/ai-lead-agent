/**
 * The aggregate read layer (design D4).
 *
 * Reads that count, group or rank live here rather than in the API, so the
 * counting happens in SQL in one round trip. Reads that fetch a row or a list
 * of rows still use the exported tables directly — this is not a repository
 * layer, it is the place where the expensive shapes live.
 */

export {
  readActivity,
  readAttention,
  readDashboardSummary,
  readFunnel,
  type ActivityEntry,
  type AttentionItem,
  type DashboardSummary,
  type FunnelStage,
  type MetricSeries,
  type SeriesPoint,
} from "./insights";

export {
  readConversionSeries,
  readDiscoverySeries,
  readScoreSeries,
  readSpendSeries,
  type AnalyticsBucket,
  type AnalyticsSeries,
} from "./analytics-series";

export {
  readRateLimits,
  readSpend,
  type RateLimitStatus,
  type SpendByStage,
  type SpendReport,
} from "./operations";

export { searchWorkspace, type SearchHit, type SearchResults } from "./search";

export {
  readDependencyHistory,
  type DependencyHistory,
  type HealthHistorySegment,
} from "./dependency-health";
