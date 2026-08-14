"use client";

import { RouteError } from "@/components/route-error";

export default function SegmentErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError title="The company" error={error} reset={reset} />;
}
