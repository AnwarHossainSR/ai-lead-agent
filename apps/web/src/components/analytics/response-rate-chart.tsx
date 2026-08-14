"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ResponseRateDatum {
  readonly label: string;
  readonly rate: number | null;
  readonly sent: number;
  readonly responded: number;
  readonly unrecorded: number;
  readonly belowMinimum: boolean;
  /**
   * Percentage-point change since a prior period, if the caller has one.
   * Nothing currently supplies this — the aggregate endpoint returns a
   * single snapshot — but the suppression rule below is enforced at the
   * wrapper regardless, so a future caller cannot draw a trend line under
   * the reporting minimum just because the data happens to be available.
   */
  readonly trendDeltaPercentagePoints?: number | null;
}

function formatPercent(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

/**
 * Shared response-rate chart (design D5). Every segment's rate is shown
 * next to the counts it was computed from, in ordinary visible text below
 * the chart — never only inside a tooltip a reader could miss — and a
 * segment below the minimum reporting sample size gets a visibly muted bar,
 * a "small sample" marker, and no trend or comparison, because a rate
 * computed from a handful of sends is not a trend worth drawing.
 */
export function ResponseRateChart({ data }: { data: readonly ResponseRateDatum[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No outreach sent in this segment yet.</p>;
  }

  const chartData = data.map((datum) => ({
    label: datum.label,
    ratePercent: datum.rate === null ? 0 : Math.round(datum.rate * 1000) / 10,
    belowMinimum: datum.belowMinimum,
  }));

  return (
    <div className="space-y-4">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} width={44} />
            <Tooltip formatter={(value) => [`${value}%`, "Response rate"]} />
            <Bar dataKey="ratePercent" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={entry.belowMinimum ? "var(--muted-foreground)" : "var(--primary)"}
                  fillOpacity={entry.belowMinimum ? 0.4 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 font-medium">Segment</th>
              <th className="px-4 py-2 font-medium">Rate</th>
              <th className="px-4 py-2 font-medium">Sent</th>
              <th className="px-4 py-2 font-medium">Responded</th>
              <th className="px-4 py-2 font-medium">Unrecorded</th>
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.label} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium">{datum.label}</td>
                <td className="px-4 py-2">
                  {datum.rate === null ? (
                    <span className="text-muted-foreground italic">unknown</span>
                  ) : (
                    <>
                      {formatPercent(datum.rate)}
                      {datum.belowMinimum ? (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          small sample
                        </span>
                      ) : datum.trendDeltaPercentagePoints != null ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {datum.trendDeltaPercentagePoints >= 0 ? "+" : ""}
                          {datum.trendDeltaPercentagePoints} pts
                        </span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="px-4 py-2">{datum.sent}</td>
                <td className="px-4 py-2">{datum.responded}</td>
                <td className="px-4 py-2">{datum.unrecorded}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
