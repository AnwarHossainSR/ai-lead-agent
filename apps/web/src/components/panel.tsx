"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Component, type ReactNode, Suspense } from "react";

import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/skeleton";

interface PanelErrorBoundaryProps {
  title: string;
  children: ReactNode;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

/**
 * Error boundaries must be class components — React has no hook equivalent.
 *
 * This only catches genuinely unexpected failures (a bug, a response body
 * that doesn't parse the way the panel expects). The expected failure modes
 * — the API slow, down, or erroring — are handled by `fetchWithTimeout`
 * returning a result the panel renders inline, never by throwing.
 */
class PanelErrorBoundary extends Component<PanelErrorBoundaryProps, PanelErrorBoundaryState> {
  override state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  override render() {
    const { error } = this.state;

    if (error !== null) {
      return (
        <div
          role="alert"
          data-slot="panel-error"
          data-tone="danger"
          className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-subtle/50 p-4"
        >
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-danger">{this.props.title} is unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * The default wait: a card-shaped placeholder rather than a grey slab (design
 * D8). A caller whose content is a table or a chart passes the matching shape
 * through `fallback` instead, so nothing moves when the data lands.
 */
function PanelSkeleton({ title }: { title: string }) {
  return <CardSkeleton label={`Loading ${title.toLowerCase()}`} />;
}

interface PanelProps {
  /** Used in the error state's message and as the boundary's accessible context. */
  title: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Wraps one panel's data-fetching in its own Suspense and error boundary
 * (design D7), so a failing or slow panel degrades on its own — the rest of
 * the page, and every other panel on it, renders normally.
 */
export function Panel({ title, fallback, children }: PanelProps) {
  return (
    <PanelErrorBoundary title={title}>
      <Suspense fallback={fallback ?? <PanelSkeleton title={title} />}>{children}</Suspense>
    </PanelErrorBoundary>
  );
}
