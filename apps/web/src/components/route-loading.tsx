import { CardSkeleton, StatSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Whole-page waits (design D8). Each route segment's `loading.tsx` picks the
 * shape its page will fill, so the layout the reader sees while waiting is the
 * layout they end up with, and nothing jumps when the data lands.
 */
export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function ListPageLoading({ columns = 6 }: { columns?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-full max-w-2xl" />
      <TableSkeleton rows={6} columns={columns} label="Loading the table" />
    </div>
  );
}

export function DetailPageLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton lines={4} label="Loading details" />
        <CardSkeleton lines={4} label="Loading details" />
        <CardSkeleton lines={3} label="Loading details" />
        <CardSkeleton lines={3} label="Loading details" />
      </div>
    </div>
  );
}

export function StatsPageLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatSkeleton className="sm:col-span-2 sm:row-span-2" label="Loading the review queue" />
        <StatSkeleton label="Loading a statistic" />
        <StatSkeleton label="Loading a statistic" />
        <StatSkeleton label="Loading a statistic" />
      </div>
    </div>
  );
}
