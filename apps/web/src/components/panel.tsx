"use client";

import { Component, type ReactNode, Suspense } from "react";

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
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4"
        >
          <p className="text-sm font-medium text-destructive">{this.props.title} is unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function PanelSkeleton() {
  return (
    <div
      data-slot="panel-skeleton"
      aria-hidden="true"
      className="h-24 animate-pulse rounded-lg border border-border bg-muted/40"
    />
  );
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
      <Suspense fallback={fallback ?? <PanelSkeleton />}>{children}</Suspense>
    </PanelErrorBoundary>
  );
}
