"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { searchWorkspaceAction } from "@/app/(workspace)/search-action";
import {
  type CommandGroup,
  CommandPalette,
  type CommandPaletteStatus,
} from "@/components/ui/command-palette";
import type { SearchResults } from "@/lib/search";

/** Long enough that a typed word is one request, short enough to feel live. */
const DEBOUNCE_MS = 200;

/**
 * The top bar's search control and the palette behind it.
 *
 * Fetching lives here rather than in `CommandPalette` so the palette stays a
 * presentational primitive that any caller can drive. What this adds is the
 * debounce, the out-of-order guard, and the mapping from the API's response to
 * the palette's groups.
 */
export function WorkspaceSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [status, setStatus] = useState<CommandPaletteStatus>("idle");
  const [error, setError] = useState<string | undefined>(undefined);

  // Every request carries the query it was issued for; a response for anything
  // other than what is currently typed is discarded rather than rendered under
  // a query it does not answer.
  const latestQuery = useRef("");

  useEffect(() => {
    const trimmed = query.trim();
    latestQuery.current = trimmed;

    if (trimmed === "") {
      setStatus("idle");
      setResults(null);
      return;
    }

    setStatus("searching");
    const timer = setTimeout(() => {
      void searchWorkspaceAction(trimmed).then((result) => {
        if (latestQuery.current !== trimmed) return;

        if (result.status === "ok") {
          setResults(result.data);
          setError(undefined);
          setStatus("ready");
        } else {
          setResults(null);
          setError(result.error);
          setStatus(result.status);
        }
      });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const groups = useMemo<CommandGroup[]>(() => {
    if (results === null) return [];
    return [
      {
        id: "companies",
        label: "Companies",
        items: results.companies.map((hit) => ({
          id: `company-${hit.id}`,
          label: hit.name,
          detail: hit.detail ?? undefined,
          href: `/companies/${hit.id}`,
        })),
      },
      {
        id: "leads",
        label: "Leads",
        items: results.leads.map((hit) => ({
          id: `lead-${hit.id}`,
          label: hit.name,
          detail: hit.detail ?? undefined,
          href: `/leads/${hit.id}`,
        })),
      },
    ];
  }, [results]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-meta text-muted-foreground transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:min-w-55"
      >
        <SearchIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">Search companies and leads</span>
        <span className="sr-only sm:hidden">Search companies and leads</span>
        <kbd className="ml-auto hidden rounded-xs border border-border px-1.5 py-px text-label sm:inline">
          Ctrl K
        </kbd>
      </button>

      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        status={status}
        error={error}
      />
    </>
  );
}
