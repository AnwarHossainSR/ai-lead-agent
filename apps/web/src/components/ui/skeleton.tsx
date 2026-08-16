import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Loading placeholders (design D8). A placeholder is decorative — it stands in
 * for content that does not exist yet — so every shape is `aria-hidden` inside a
 * container marked `aria-busy`, and assistive technology is told the region is
 * loading rather than read a row of empty boxes.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/**
 * `<output>` carries an implicit `role="status"` and its polite live region, so
 * the wait is announced once by name instead of as a row of empty boxes.
 */
function SkeletonRegion({
  className,
  label = "Loading",
  children,
  ...props
}: React.ComponentProps<"output"> & { label?: string }) {
  return (
    <output
      data-slot="skeleton-region"
      aria-busy="true"
      aria-label={label}
      className={cn("block w-full", className)}
      {...props}
    >
      {children}
    </output>
  );
}

/** Stable keys for placeholder shapes, which have no data of their own. */
function shapeKeys(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

/** n rows at the real column count, so the table does not jump when data lands. */
function TableSkeleton({
  rows = 5,
  columns = 4,
  label = "Loading table",
  className,
}: {
  rows?: number;
  columns?: number;
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonRegion
      label={label}
      className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}
    >
      <div className="flex gap-4 border-b border-border bg-muted/50 px-4 py-2.5">
        {shapeKeys(columns, "head").map((key) => (
          <Skeleton key={key} className="h-3 flex-1" />
        ))}
      </div>
      {shapeKeys(rows, "row").map((rowKey) => (
        <div key={rowKey} className="flex gap-4 border-b border-border px-4 py-3 last:border-0">
          {shapeKeys(columns, `${rowKey}-cell`).map((cellKey) => (
            <Skeleton key={cellKey} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </SkeletonRegion>
  );
}

function CardSkeleton({
  lines = 3,
  label = "Loading",
  className,
}: {
  lines?: number;
  label?: string;
  className?: string;
}) {
  const lineKeys = shapeKeys(lines, "line");

  return (
    <SkeletonRegion
      label={label}
      className={cn("space-y-3 rounded-lg border border-border bg-card p-4.5", className)}
    >
      <Skeleton className="h-4 w-1/3" />
      {lineKeys.map((key, index) => (
        <Skeleton
          key={key}
          className={index === lineKeys.length - 1 ? "h-3 w-2/3" : "h-3 w-full"}
        />
      ))}
    </SkeletonRegion>
  );
}

/** The dashboard's stat card: a small caption over a large number. */
function StatSkeleton({
  label = "Loading statistic",
  className,
}: { label?: string; className?: string }) {
  return (
    <SkeletonRegion
      label={label}
      className={cn("space-y-3 rounded-lg border border-border bg-card p-4.5", className)}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-32" />
    </SkeletonRegion>
  );
}

function ChartSkeleton({
  label = "Loading chart",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const bars = [55, 80, 40, 95, 65, 75, 50];

  return (
    <SkeletonRegion
      label={label}
      className={cn("space-y-3 rounded-lg border border-border bg-card p-4.5", className)}
    >
      <Skeleton className="h-3 w-32" />
      <div className="flex h-40 items-end gap-3">
        {bars.map((height) => (
          <Skeleton key={`bar-${height}`} className="flex-1" style={{ height: `${height}%` }} />
        ))}
      </div>
    </SkeletonRegion>
  );
}

export { CardSkeleton, ChartSkeleton, Skeleton, SkeletonRegion, StatSkeleton, TableSkeleton };
