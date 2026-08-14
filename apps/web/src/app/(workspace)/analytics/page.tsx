import {
  LEAD_PRIORITIES,
  findCategory,
  findIndustry,
  findPriorityBand,
  findService,
} from "@mela/config";

import {
  ResponseRateChart,
  type ResponseRateDatum,
} from "@/components/analytics/response-rate-chart";
import { Unavailable } from "@/components/data-state";
import { Panel } from "@/components/panel";
import { ChartSkeleton } from "@/components/ui/skeleton";
import type { AnalyticsSegment, OutreachAggregate } from "@/lib/analytics";
import { apiUrl } from "@/lib/api";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { formatLabel } from "@/lib/format-label";

/** Score deciles are labelled by their score range; decile 9 covers 90–100 (11 values, capped by the API). */
function scoreDecileLabel(value: string): string {
  const match = /^decile_(\d)$/.exec(value);
  if (match === null) {
    return formatLabel(value);
  }
  const decile = Number(match[1]);
  return decile === 9 ? "90–100" : `${decile * 10}–${decile * 10 + 9}`;
}

const SEGMENT_LABEL: Record<AnalyticsSegment, (value: string) => string> = {
  industry: (value) => (value === "unknown" ? "Unknown" : (findIndustry(value)?.name ?? value)),
  service: (value) => (value === "unknown" ? "Unknown" : (findService(value)?.name ?? value)),
  opportunityCategory: (value) =>
    value === "unknown" ? "Unknown" : (findCategory(value)?.name ?? value),
  priorityBand: (value) =>
    value === "unknown" ? "Unknown" : (findPriorityBand(value)?.name ?? formatLabel(value)),
  scoreDecile: scoreDecileLabel,
};

/** Orders each segment's rows; an unresolved "unknown" value always sorts last. */
function segmentSortKey(segment: AnalyticsSegment, value: string): number | string {
  if (value === "unknown") {
    return segment === "scoreDecile" ? 99 : "￿";
  }
  if (segment === "priorityBand") {
    const index = LEAD_PRIORITIES.indexOf(value as (typeof LEAD_PRIORITIES)[number]);
    return index === -1 ? "￿" : index;
  }
  if (segment === "scoreDecile") {
    const match = /^decile_(\d)$/.exec(value);
    return match ? Number(match[1]) : 99;
  }
  return SEGMENT_LABEL[segment](value);
}

function toDatum(segment: AnalyticsSegment, aggregate: OutreachAggregate): ResponseRateDatum {
  return {
    label: SEGMENT_LABEL[segment](aggregate.value),
    rate: aggregate.responseRate,
    sent: aggregate.sent,
    responded: aggregate.responded,
    unrecorded: aggregate.unrecorded,
    belowMinimum: aggregate.belowMinimumSampleSize,
  };
}

async function SegmentChart({ segment, title }: { segment: AnalyticsSegment; title: string }) {
  const url = apiUrl(`/analytics/outreach?segment=${segment}`);
  const result =
    url === null
      ? ({ status: "unreachable", error: "API_URL is not configured." } as const)
      : await fetchWithTimeout<OutreachAggregate[]>(url);

  if (result.status !== "ok") {
    return <Unavailable title={title} status={result.status} error={result.error} />;
  }

  const sorted = [...result.data].sort((left, right) => {
    const leftKey = segmentSortKey(segment, left.value);
    const rightKey = segmentSortKey(segment, right.value);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });

  return <ResponseRateChart data={sorted.map((aggregate) => toDatum(segment, aggregate))} />;
}

const SEGMENTS: ReadonlyArray<{ segment: AnalyticsSegment; title: string }> = [
  { segment: "industry", title: "By industry" },
  { segment: "service", title: "By recommended service" },
  { segment: "opportunityCategory", title: "By opportunity category" },
  { segment: "priorityBand", title: "By priority band" },
  { segment: "scoreDecile", title: "By score decile" },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Response rate by industry, service, opportunity category, priority band and score decile —
          always with counts. A segment below the minimum reporting sample size is marked and shows
          no trend.
        </p>
      </div>

      {SEGMENTS.map(({ segment, title }) => (
        <Panel
          key={segment}
          title={title}
          fallback={<ChartSkeleton label={`Loading ${title.toLowerCase()}`} />}
        >
          <div className="rounded-lg border border-border p-4">
            <h2 className="mb-4 font-medium">{title}</h2>
            <SegmentChart segment={segment} title={title} />
          </div>
        </Panel>
      ))}
    </div>
  );
}
