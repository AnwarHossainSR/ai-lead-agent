## Context

See `proposal.md` — Why. The constraints that shape the approach:

- **`apps/web` is Next.js 16.3.0 / React 19.2.8 / Tailwind CSS v4**, styled with
  shadcn conventions (`shadcn` 4.16.2 supplies `shadcn/tailwind.css`) on top of
  `@base-ui/react` 1.7.0. Also already installed and unused-or-underused:
  `lucide-react` 1.31.0, `tw-animate-css` 1.4.0, `class-variance-authority`
  0.7.1, `tailwind-merge` 3.6.0, `recharts` 3.10.1.
- **Tailwind v4 has no `tailwind.config.ts`.** The theme lives entirely in
  `src/app/globals.css` — `@theme inline` maps `--color-*` utilities onto the
  `--*` variables defined in `:root` and `.dark`. Adding a colour means adding a
  variable in three places (the `@theme inline` mapping, `:root`, `.dark`), not
  editing a config file.
- **Every current token is achromatic.** `:root` and `.dark` define 22 colours,
  all `oklch(L 0 0)` — chroma zero. `--chart-1` … `--chart-5` are five greys.
  This is the single largest cause of the "everything looks the same" problem.
- **Dark mode is defined but unreachable.** `@custom-variant dark (&:is(.dark *))`
  and a full `.dark` block exist; nothing ever puts `dark` on an element.
- **`components/ui/` holds three files** — `button.tsx`, `popover.tsx`,
  `select.tsx`. Everything else is hand-rolled Tailwind in feature components.
- **Server Components do the fetching.** Pages are async Server Components;
  `fetchWithTimeout` returns a discriminated result (`ok` / `degraded` /
  `unreachable`) rather than throwing, and `<Panel>` (`components/panel.tsx`)
  wraps each panel in its own `Suspense` + class error boundary. Mutations are
  Server Actions in `actions.ts` files.
- **Nothing in `src/` mentions `toast` or `aria-live`.** There is no
  notification surface to extend; one has to be introduced.
- **The provenance components are the product's spine.** `fact.tsx`,
  `evidence.tsx`, `generated.tsx` encode observed / inferred / unknown and
  AI-generated. They have tests. They must be restyled, never simplified.
- **Tests to keep green:** vitest component tests co-located with components,
  `vitest-axe` accessibility tests (`*.a11y.test.tsx`), and two Playwright
  specs. Playwright expansion is out of scope (see proposal — Non-goals), but
  existing specs must not be left broken.

## Goals / Non-Goals

**Goals:**

- One place to change a colour, and a token vocabulary that carries meaning
  (`--color-success` etc.) rather than only lightness.
- A primitive layer thick enough that feature components stop hand-rolling
  borders, padding and hover states — restyling a table becomes editing one
  file, not eleven.
- A notification path that a Server Action can reach, given that Server Actions
  return to a Server Component and cannot themselves call a client hook.
- Restyling without touching data flow: the same fetches, the same props, the
  same role gating.

**Non-Goals (design-level, beyond the proposal's):**

- No change to `fetchWithTimeout`'s result shape or to `<Panel>`'s
  Suspense/error-boundary structure — the redesign consumes them, it does not
  redesign them.
- No move to a client-side data-fetching library, no `use client` creep: pages
  stay Server Components and only leaf interactivity is a Client Component.
- No CSS-in-JS, no `styled-components`, no design-token build step. Plain CSS
  variables in `globals.css`.
- No visual-regression / screenshot testing infrastructure in this change.

## Decisions

### D1 — Keep the shadcn token names; change only their values, and add semantic roles

`--primary`, `--muted`, `--card`, `--border`, `--ring`, `--destructive`, … keep
their names, so `bg-card`, `text-muted-foreground` and every existing class list
picks up the new theme for free. Added on top, in the same three places
(`@theme inline`, `:root`, `.dark`):

```
--success / --success-foreground / --success-subtle
--warning / --warning-foreground / --warning-subtle
--info    / --info-foreground    / --info-subtle
--danger  / --danger-foreground  / --danger-subtle   (aliases --destructive)
```

The `*-subtle` variant is the low-chroma background a badge sits on; the base is
the border and icon colour; `*-foreground` is text on the base.

**Why not** a fresh token vocabulary: it would force a rewrite of every class
list in the app for no benefit, and would fight `shadcn/tailwind.css`, which the
project already imports.

**Why not** raw Tailwind palette classes (`bg-amber-100 text-amber-800`, as
`lead-list-table.tsx:58` does today): they have no dark-mode counterpart without
duplicating every class with a `dark:` variant, and they place the meaning of a
colour at each call site rather than in one definition.

### D2 — Palette: one branded hue plus four status hues, expressed in OKLCH

Stay in OKLCH (already the file's unit) because it makes light/dark pairs
predictable — the same hue and chroma at a different lightness stays the same
colour. Concretely:

- **Primary**: a deep blue (hue ≈ 255) — a sales-intelligence workspace, not a
  consumer app; blue reads as trustworthy and does not collide with the status
  hues.
- **Success** green ≈ 150, **warning** amber ≈ 75, **danger** red ≈ 27 (keeps
  the existing `--destructive` hue), **info** cyan ≈ 220.
- **Surfaces**: not pure white and not pure black. `--background` a near-white
  with a trace of the primary hue in light mode, and a slate-tinted near-black
  in dark mode, with `--card` one step lifted from `--background` so cards read
  as raised without a heavy border.
- **Chart ramp**: five hues spread around the wheel at matched lightness and
  chroma, chosen so adjacent series stay distinguishable in greyscale.

Every foreground/background pair used for text must clear 4.5:1, and every
meaningful non-text pair 3:1, in both themes — verified as part of task 1.

### D3 — Status semantics live in one map, not at call sites

A single module, `src/lib/status-tone.ts`, maps every domain status the UI
renders — lead priority, lead status, outreach status, staleness, job state,
health — onto one of `success | warning | danger | info | neutral`. Badges take
a tone, never a colour. This is what makes the spec's "the same meaning is the
same colour on every screen" checkable by a unit test rather than by eye.

**Why not** put the colour on the badge at each call site: that is exactly the
current situation, and it is why staleness is amber in one table and plain text
in another.

### D4 — Theme preference: a cookie, read by the server, plus a client toggle

The preference (`light` / `dark` / `system`) is stored in a cookie, read in
`app/layout.tsx` (a Server Component) and written as `class="dark"` and
`style="color-scheme: dark"` directly onto `<html>` during server rendering.
The toggle is a small Client Component that updates the class immediately and
persists the choice via a Server Action.

**Why the cookie over `localStorage`:** `localStorage` is unreadable during
server rendering, so the server would emit the wrong theme and a blocking inline
script would have to correct it before first paint — the classic
`next-themes` flash-prevention hack. The spec forbids the flash; a cookie
removes the need for the hack entirely because the server already knows.

**Why not add `next-themes`:** it exists to solve the `localStorage` problem
above, which the cookie approach does not have, and it needs
`suppressHydrationWarning` on `<html>`. Not worth a dependency.

For `system`, no class is written and the `.dark` styles are additionally
selected by `@media (prefers-color-scheme: dark)` — so the OS preference is
honoured with no JavaScript at all.

### D5 — Toasts: Base UI's `Toast` if the installed version has it, otherwise a
small in-house provider — either way, no new dependency

`@base-ui/react` 1.7.0 is expected to export a `Toast` primitive (portal,
viewport, timers, hover-to-pause, swipe-to-dismiss, `aria-live` handling). Task 4
verifies this against the installed package first. If it is present it is
wrapped in `components/ui/toast.tsx` and given theme styling. If it is not, the
fallback is a ~120-line provider of our own: a React context holding a bounded
queue, a portal into an `aria-live="polite"` / `role="status"` region (with
`assertive` for errors), and per-toast dismiss timers.

**Why not `sonner`:** it is the obvious choice and it is genuinely good, but it
brings its own theming surface to reconcile with our tokens, and Base UI —
already a dependency, already the source of `popover` and `select` — covers the
same ground. The fallback is small enough that the decision does not hinge on
which way task 4's check comes out.

### D6 — Getting a Server Action's outcome into a client toast

Server Actions run on the server and cannot call a client hook. Three of the
four action files currently end in `revalidatePath` + `redirect`, so their
outcome is invisible.

The pattern adopted: **every action returns a serialisable result**

```ts
type ActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };
```

and the form that invokes it is a Client Component using React 19's
`useActionState`. A `useToastOnActionResult(state)` hook in
`src/lib/use-toast-on-action-result.ts` raises the toast when the returned state
changes. `sign-in-form.tsx` already uses `useActionState`, so this generalises a
pattern the codebase has rather than inventing one.

Actions that must navigate keep their `redirect`, and carry the message across
by setting a short-lived flash cookie that the destination layout reads once and
hands to the toast provider as an initial toast.

**Why not** encode the message in a query string (`?toast=approved`): it leaks
into shareable URLs and survives reloads, re-firing the toast.

**Why not** move mutations to client-side `fetch` so the result is naturally in
the client: it would abandon Server Actions, the session-cookie forwarding built
in `add-authentication`, and the CSRF posture that comes with them.

### D7 — Primitives to add under `src/components/ui/`

`card.tsx`, `badge.tsx` (tone-driven, D3), `table.tsx`, `skeleton.tsx`,
`input.tsx`, `label.tsx`, `dialog.tsx`, `tooltip.tsx`, `tabs.tsx`,
`separator.tsx`, `empty-state.tsx`, `page-header.tsx`, `toast.tsx`,
`theme-toggle.tsx`, `icon-button.tsx` — alongside the existing `button.tsx`,
`popover.tsx`, `select.tsx`. Variants use `class-variance-authority`, class
merging uses the existing `cn` in `src/lib/utils.ts`, interactive behaviour
comes from `@base-ui/react`, icons from `lucide-react`.

Primitives are presentational and dependency-free — no fetching, no `next/link`
coupling — so they render in jsdom and stay unit-testable, matching the
convention `lead-list-table.tsx` documents ("pure presentational … which is what
makes it testable at all").

### D8 — Skeletons that match their content, declared per route segment

The current fallback is a single grey box (`panel.tsx`'s `PanelSkeleton`,
`h-24 animate-pulse`). Replaced by shaped skeletons: `TableSkeleton` (n rows ×
the real column widths), `CardSkeleton`, `StatSkeleton`, `ChartSkeleton`, each
rendered `aria-hidden` inside a container marked `aria-busy`. `<Panel>` keeps
its signature — callers pass the right skeleton through the existing `fallback`
prop — and `loading.tsx` files are added per route segment for whole-page waits.

### D9 — Responsive tables: the same rows, two presentations

Below `md`, `<DataTable>` renders each row as a stacked card carrying the same
cells with their column labels, instead of a horizontally scrolling table. Both
presentations come from one row definition, so the two cannot drift. Only tables
with more than four columns opt in — leads (7), companies, failed jobs.

**Why not** `overflow-x-auto` alone (today's behaviour): a seven-column table on
a phone means the reader loses the company name — the one column that identifies
the row — as soon as they scroll to see the score.

**Why not** hiding columns below a breakpoint: it silently withholds data, which
runs against the product's principle of not overstating or understating what is
known.

### D10 — Navigation: collapsible sidebar, drawer on small screens

`sidebar.tsx` becomes icon + label with a persisted collapsed/expanded state
(same cookie mechanism as D4), and below `md` it renders as a drawer opened from
a header control — closing on route change and on `Escape`, with focus trapped
while open. Today it is `hidden … md:block`, so a phone user has no navigation
at all; that is a functional gap the redesign closes.

### D11 — Motion via `tw-animate-css`, gated on `prefers-reduced-motion`

Durations standardised as tokens (`--duration-fast: 120ms`,
`--duration-base: 200ms`, `--duration-slow: 320ms`) and a global
`@media (prefers-reduced-motion: reduce)` block in `globals.css` that collapses
animation and transition durations to `0.01ms`. No motion carries information on
its own.

### D12 — Charts read the theme at render time

A `chart-theme.ts` helper resolves `--chart-1` … `--chart-5`, grid, axis and
tooltip colours from the computed CSS variables, and a shared `<ChartTooltip>`
and `<ChartEmpty>` replace Recharts' defaults. Because the values are read from
CSS variables rather than hard-coded, a theme switch restyles the chart with no
chart-specific code.

### D13 — Test strategy: extend, don't rewrite

- Component tests assert behaviour and accessible names, not class names —
  so most survive a restyle unchanged. Where a test asserts on a class or a
  DOM shape the redesign changes, it is updated in the same task as the
  component, never deleted.
- New unit tests: the status-tone map (D3), the theme cookie round-trip (D4),
  the toast queue's bounding and dismissal (D5), the action-result hook (D6),
  responsive table row-definition parity (D9).
- `vitest-axe` a11y tests are extended to run each page fixture twice, once per
  theme, satisfying the spec's "automated checks pass in both themes".
- Contrast ratios are asserted by a unit test over the token definitions rather
  than checked by eye, so a later palette edit cannot silently break AA.
- The two Playwright specs are run and any selector broken by the restyle is
  repaired; no new E2E specs (proposal — Non-goals).

## Risks / Trade-offs

- **A restyle of 25+ components in one change is a large diff, and a
  regression can hide anywhere in it** → sequenced bottom-up in `tasks.md`:
  tokens, then primitives, then shell, then one feature area per task, each with
  its tests run before moving on. Every step leaves the app working.
- **Existing tests may assert on the markup being replaced** → treat a failing
  assertion as a decision point: if the behaviour it protects still holds, update
  the selector; if the behaviour changed, the change is out of scope and the
  component is wrong. Never delete a test to make a restyle pass.
- **Restyling could accidentally weaken the provenance signals** (an inferred
  value styled to look observed) → the spec makes this a requirement with
  scenarios, `fact`/`evidence`/`generated` keep their existing tests, and their
  restyle is its own task rather than a side effect of another.
- **Restyling could accidentally ungate a role-gated control** — a
  `canApprove`-driven `disabled` lost in a rewrite is a security-relevant bug,
  not a cosmetic one → the "presentation-only change" requirement, the existing
  `message-review-card` gating tests, and a review of every `canApprove` /
  `role` reference before and after.
- **Base UI 1.7.0 may not export `Toast`** → D5's fallback; the check is task
  4's first step, so the branch is taken before any toast work is built on it.
- **A cookie-driven theme makes pages that read it dynamic** → the workspace is
  already fully dynamic (session cookie on every request, `no-store` reads); no
  static generation is lost.
- **OKLCH support** → all target browsers for a 2026 internal workspace support
  it, and the file already uses it exclusively; not a new risk.
- **Scope creep from "make it awesome"** → the spec's "presentation-only
  change" requirement is the boundary. Anything that changes what a page shows
  is a separate proposal.

## Migration Plan

No data migration, no API change, no deployment step. The rollout is the ordinary
commit sequence in `tasks.md`, each step independently revertable:

1. Tokens and theme land first and are a strict superset — the old class lists
   keep working, so the app is fully functional after step 1 with a new palette
   and nothing else changed.
2. Primitives are added but not yet adopted; nothing breaks because nothing
   references them yet.
3. Feature areas migrate one at a time. Any single area can be reverted without
   touching the others.

Rollback is `git revert` of the offending commit; no state anywhere outside the
repository is changed by this work. The one persisted artefact is the theme
cookie, which is ignored by code that does not look for it.

## Open Questions

- **Brand hue.** The design specifies deep blue (D2). If a brand colour is
  chosen later, it is a change to a handful of `:root` / `.dark` variable values
  and nothing else — deferrable precisely because D1 keeps colour in one place.
- **Density preference (comfortable / compact) as a user setting.** The tables
  will ship at one density. Adding a toggle later reuses the D4 cookie
  mechanism, so deferring costs nothing.
