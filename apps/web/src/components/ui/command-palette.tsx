"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { Unavailable } from "@/components/data-state";
import { cn } from "@/lib/utils";

export interface CommandItem {
  readonly id: string;
  readonly label: string;
  /** What distinguishes this result from another with the same name. */
  readonly detail?: string;
  readonly href: string;
}

export interface CommandGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly CommandItem[];
}

export type CommandPaletteStatus = "idle" | "searching" | "ready" | "degraded" | "unreachable";

/**
 * Find a company or a lead without leaving the keyboard.
 *
 * Base UI's dialog supplies the two behaviours the spec names and this file
 * would otherwise have to reimplement badly: focus is trapped while the palette
 * is open, and it returns to whatever had it when the palette is dismissed.
 *
 * What is added here is the shortcut, the arrow-key walk over grouped results,
 * and the rule that a search returning nothing says so in a sentence — never an
 * empty list, which reads as a component that failed to render.
 */
export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  groups,
  status,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  groups: readonly CommandGroup[];
  status: CommandPaletteStatus;
  /** What the search said when it refused, if it did. */
  error?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const flattened = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  // ⌘K on a Mac, Ctrl+K elsewhere. Registered once on the window so the
  // shortcut works from anywhere on the page, not only from the top bar.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  // A new query means a new set of results, and whatever was highlighted in
  // the old one no longer refers to anything. Adjusted during render rather
  // than in an effect: React re-runs this pass before touching the DOM, so the
  // highlight is never briefly pointing at a result from the previous query.
  const [queryAtLastReset, setQueryAtLastReset] = useState(query);
  if (query !== queryAtLastReset) {
    setQueryAtLastReset(query);
    setActiveIndex(0);
  }

  const go = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flattened.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % flattened.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + flattened.length) % flattened.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flattened[Math.min(activeIndex, flattened.length - 1)];
      if (item) go(item.href);
    }
  }

  const activeId = flattened[activeIndex] ? `${listId}-${flattened[activeIndex].id}` : undefined;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[1px] duration-(--duration-base) data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          data-slot="command-palette"
          initialFocus={inputRef}
          className="fixed top-24 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg outline-none duration-(--duration-base) data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
          <DialogPrimitive.Title className="sr-only">Search the workspace</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Find a company or a lead by name or domain. Use the arrow keys to move through results
            and Enter to open one.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {/* The ARIA 1.2 combobox pattern: focus stays in the input and the
                highlighted option is named by `aria-activedescendant`, which is
                what lets the arrow keys walk the list without moving focus. */}
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search companies and leads…"
              aria-label="Search companies and leads"
              aria-autocomplete="list"
              aria-expanded={flattened.length > 0}
              aria-controls={listId}
              aria-activedescendant={activeId}
              className="w-full border-0 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-80 overflow-y-auto p-1.5">
            <Results
              listId={listId}
              groups={groups}
              flattened={flattened}
              activeIndex={activeIndex}
              status={status}
              error={error}
              query={query}
              onSelect={go}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Results({
  listId,
  groups,
  flattened,
  activeIndex,
  status,
  error,
  query,
  onSelect,
}: {
  listId: string;
  groups: readonly CommandGroup[];
  flattened: readonly CommandItem[];
  activeIndex: number;
  status: CommandPaletteStatus;
  error?: string;
  query: string;
  onSelect: (href: string) => void;
}) {
  if (status === "degraded" || status === "unreachable") {
    return (
      <Unavailable
        title="Search"
        status={status}
        error={error ?? "The search endpoint did not answer."}
        className="m-1.5"
      />
    );
  }

  if (status === "idle" || query.trim() === "") {
    return (
      <p className="px-3 py-6 text-center text-meta text-muted-foreground">
        Type to search companies and leads by name or domain.
      </p>
    );
  }

  if (status === "searching") {
    return <p className="px-3 py-6 text-center text-meta text-muted-foreground">Searching…</p>;
  }

  if (flattened.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-meta text-muted-foreground">
        Nothing matches “{query}”. No company or lead in this workspace has that name or domain.
      </p>
    );
  }

  let index = -1;

  return (
    // The listbox half of the combobox above. It is deliberately not focusable
    // and deliberately not a `<select>`: in the `aria-activedescendant` pattern
    // focus stays in the input, and a native select cannot hold grouped rich
    // rows or be driven by the same keystrokes.
    // biome-ignore lint/a11y/useFocusableInteractive: focus stays on the combobox input by design
    // biome-ignore lint/a11y/useSemanticElements: a native select cannot express this listbox
    <div id={listId} role="listbox" aria-label="Search results" className="flex flex-col gap-2">
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div
            key={group.id}
            // biome-ignore lint/a11y/useSemanticElements: a group inside a listbox, not a form fieldset
            role="group"
            aria-label={group.label}
          >
            <p className="px-2.5 py-1 text-label font-semibold tracking-eyebrow text-muted-foreground uppercase">
              {group.label}
            </p>
            {group.items.map((item) => {
              index += 1;
              const active = index === activeIndex;
              return (
                // A button rather than a div: it stays activatable by pointer
                // and by Enter without this file reimplementing either.
                <button
                  key={item.id}
                  type="button"
                  id={`${listId}-${item.id}`}
                  // biome-ignore lint/a11y/useSemanticElements: an option inside a listbox, not a standalone control
                  role="option"
                  tabIndex={-1}
                  aria-selected={active}
                  onClick={() => onSelect(item.href)}
                  className={cn(
                    "flex w-full items-baseline gap-2 rounded-md px-2.5 py-2 text-left text-meta transition-colors duration-(--duration-fast)",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="truncate font-medium">{item.label}</span>
                  {item.detail ? (
                    <span className="truncate text-label text-muted-foreground">{item.detail}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
    </div>
  );
}
