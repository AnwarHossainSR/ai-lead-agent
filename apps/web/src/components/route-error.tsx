"use client";

import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardEyebrow } from "@/components/ui/card";

/**
 * The body of every route segment's `error.tsx` (spec: error and degraded
 * state). A segment file is a thin wrapper so Next.js gets its own Client
 * Component boundary per segment while the treatment stays in one place.
 *
 * `reset` re-renders the segment. It is offered rather than a reload because a
 * reload also throws away the rest of the page, which may be perfectly fine.
 */
export function RouteError({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card rail="unknown" tone="danger" className="max-w-2xl">
      <CardContent className="flex flex-col gap-3 pt-5">
        <div className="flex items-center gap-2">
          <TriangleAlertIcon className="size-4 text-danger" aria-hidden="true" />
          <CardEyebrow className="text-danger">Something went wrong</CardEyebrow>
        </div>

        <h1 className="text-lg font-semibold">{title} could not be shown</h1>

        <p className="text-sm text-muted-foreground">
          {error.message || "The page failed while it was being rendered."}
        </p>

        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}

        <div className="mt-1 flex gap-2">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
