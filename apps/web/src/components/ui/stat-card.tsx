import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { Fact } from "@/components/fact";
import { Card } from "@/components/ui/card";
import { type SeriesPoint, Sparkline } from "@/components/ui/sparkline";
import type { Tone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  /** What is being counted, in two or three words. */
  label: string;
  /** The current period's value. `null` when nothing was measured at all. */
  value: number | null;
  /**
   * The preceding period's value, or `null` when the preceding period holds
   * nothing to compare against (design D5). `null` is not zero: a workspace's
   * first week has no prior week, and rendering that as `+100%` is the single
   * most prominent lie this card could tell.
   */
  previous: number | null;
  series?: readonly SeriesPoint[];
  /** How many points a complete series holds. Defaults to a week. */
  expectedPoints?: number;
  format?: (value: number) => string;
  /**
   * Whether a rise is an improvement. `null` for a metric with no direction —
   * spend going up is neither good nor bad on its own — and the delta is then
   * shown without a tone.
   */
  higherIsBetter?: boolean | null;
  icon?: React.ReactNode;
  /** Where the number came from, if the reader can go and look. */
  href?: string;
  className?: string;
}

interface Delta {
  readonly change: number;
  /** `null` when the previous period was zero, so a ratio has no meaning. */
  readonly percent: number | null;
}

function deltaOf(value: number | null, previous: number | null): Delta | null {
  if (value === null || previous === null) return null;
  const change = value - previous;
  if (previous === 0) return { change, percent: null };
  return { change, percent: change / previous };
}

function deltaTone(change: number, higherIsBetter: boolean | null): Tone {
  if (change === 0 || higherIsBetter === null) return "neutral";
  const improved = higherIsBetter ? change > 0 : change < 0;
  return improved ? "success" : "danger";
}

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-muted-foreground",
};

/**
 * A headline count with its own trend.
 *
 * The delta is rendered from `previous`, and there is no branch here that can
 * produce one without it: an absent comparison is stated in words, and a
 * previous period of zero shows the absolute change rather than a percentage
 * of nothing.
 */
export function StatCard({
  label,
  value,
  previous,
  series,
  expectedPoints = 7,
  format = (n) => n.toLocaleString("en-US"),
  higherIsBetter = true,
  icon,
  href,
  className,
}: StatCardProps) {
  const delta = deltaOf(value, previous);

  return (
    <Card data-slot="stat-card" className={cn("min-h-32 gap-3 p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-label font-semibold tracking-eyebrow text-muted-foreground uppercase">
          {href ? (
            <Link
              href={href}
              className="transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:rounded-xs focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {label}
            </Link>
          ) : (
            label
          )}
        </p>
        {icon ? (
          <span
            aria-hidden="true"
            className="text-muted-foreground [&_svg:not([class*='size-'])]:size-3.5"
          >
            {icon}
          </span>
        ) : null}
      </div>

      <p data-numeric className="text-figure font-semibold">
        <Fact
          fact={value === null ? { certainty: "unknown" } : { certainty: "observed", value }}
          format={format}
        />
      </p>

      <div className="mt-auto flex items-end justify-between gap-3">
        <DeltaLine delta={delta} previous={previous} higherIsBetter={higherIsBetter} />
        {series ? (
          <Sparkline points={series} expectedPoints={expectedPoints} label={label} />
        ) : null}
      </div>
    </Card>
  );
}

function DeltaLine({
  delta,
  previous,
  higherIsBetter,
}: {
  delta: Delta | null;
  previous: number | null;
  higherIsBetter: boolean | null;
}) {
  if (delta === null) {
    return (
      <p data-slot="stat-delta-absent" className="text-label text-muted-foreground italic">
        {previous === null ? "No prior period recorded" : "Nothing measured this period"}
      </p>
    );
  }

  const tone = deltaTone(delta.change, higherIsBetter);
  const Icon =
    delta.change === 0 ? MinusIcon : delta.change > 0 ? TrendingUpIcon : TrendingDownIcon;
  const sign = delta.change > 0 ? "+" : "";

  return (
    <p
      data-slot="stat-delta"
      data-tone={tone}
      className={cn("flex items-center gap-1 text-meta", TONE_TEXT[tone])}
    >
      <Icon className="size-3" aria-hidden="true" />
      {delta.percent === null ? (
        // The previous period was zero. A percentage of nothing is not a
        // number, so the absolute change is shown and the baseline is named.
        <span>
          {sign}
          {delta.change.toLocaleString("en-US")} from none recorded
        </span>
      ) : (
        <span>
          {sign}
          {Math.abs(delta.percent * 100) < 10
            ? (delta.percent * 100).toFixed(1)
            : Math.round(delta.percent * 100)}
          % ({sign}
          {delta.change.toLocaleString("en-US")})
        </span>
      )}
    </p>
  );
}
