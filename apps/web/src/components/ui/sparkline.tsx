"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

import type { Tone } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

/** One recorded point in a daily series. */
export interface SeriesPoint {
  /** The day the value covers, as an ISO 8601 date. */
  readonly at: string;
  readonly value: number;
}

const TONE_STROKE: Record<Tone | "primary", string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--muted-foreground)",
};

/**
 * A line over a daily series (design D5).
 *
 * Two rules the shape of the data makes it easy to break, both enforced here so
 * no caller has to remember them:
 *
 * 1. **An empty series draws nothing.** A flat line at zero across a window
 *    nobody recorded reads as "the number was zero every day", which is a
 *    different fact from "nothing was recorded". The empty branch says which.
 * 2. **A short series says it is short.** Recharts will happily stretch five
 *    points across the full width, and the reader has no way to tell that from
 *    a complete week. The count is stated in words beneath the line.
 */
export function Sparkline({
  points,
  expectedPoints,
  label,
  tone = "primary",
  className,
}: {
  points: readonly SeriesPoint[];
  /** How many points a complete window holds — seven, for a week of days. */
  expectedPoints: number;
  /** What the series measures, for readers who cannot see the line. */
  label: string;
  tone?: Tone | "primary";
  className?: string;
}) {
  if (points.length === 0) {
    return (
      <p
        data-slot="sparkline-empty"
        className={cn("text-label text-muted-foreground italic", className)}
      >
        No daily record yet
      </p>
    );
  }

  const stroke = TONE_STROKE[tone];
  const partial = points.length < expectedPoints;
  const values = points.map((point) => point.value);
  const summary = `${label}: ${points.length} of ${expectedPoints} days recorded, from ${values[0]} to ${values[values.length - 1]}`;

  return (
    <div data-slot="sparkline" className={cn("flex flex-col gap-0.5", className)}>
      {/* The chart is decoration over a number stated elsewhere; the label
          carries the same content for a reader who cannot see it. */}
      <div role="img" aria-label={summary} className="h-6 w-[86px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points.map((point) => ({ ...point }))}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={stroke}
              strokeWidth={1.5}
              // A single point has no line to draw, so it is drawn as a dot
              // rather than rendering an empty box.
              dot={points.length === 1 ? { r: 2, fill: stroke } : false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {partial ? (
        <p data-slot="sparkline-coverage" className="text-label text-muted-foreground">
          {points.length} of {expectedPoints} days recorded
        </p>
      ) : null}
    </div>
  );
}
