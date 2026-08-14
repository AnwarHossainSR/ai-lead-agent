## Why

Every screen in `apps/web` works but looks unfinished: the theme is literally
achromatic (every `--color-*` token in `globals.css` is `oklch(… 0 0)`, chroma
zero, including all five chart colours), tables are undifferentiated grey rows,
there is no toast or notification surface anywhere in the codebase, and a
mutation's outcome is only visible as a page re-render. The product is a
sales-intelligence workspace an operator stares at all day — the visual and
interaction quality is now the weakest part of a system whose data layer,
provenance model and approval workflow are already careful and complete.

This change covers the **surface layer of the roadmap** — a follow-on to
`add-dashboard` (13) and `add-authentication` (14), which built every page and
gated it, but deliberately kept presentation minimal. It changes how the
existing pages look and feel; it does not change what they show.

## What Changes

- **A real colour system.** Replace the chroma-zero palette with a designed
  light and dark theme: a branded primary hue, semantic status colours
  (success / warning / danger / info) used consistently for lead priority,
  outreach status, staleness and health, and a five-colour chart ramp that is
  actually distinguishable. Tokens stay the same shadcn variable names so no
  component's class list needs a rewrite to pick up the theme.
- **A dark mode a user can choose.** `.dark` styles already exist but nothing
  can turn them on. Add a persisted theme preference (light / dark / system)
  with no flash of the wrong theme on first paint.
- **A shared UI kit.** Grow `components/ui/` past its current three files
  (button, popover, select) with the primitives every page is currently
  hand-rolling: card, badge, table, skeleton, input, dialog, tooltip, tabs,
  separator, empty-state, page-header.
- **Toasts for every mutation.** Approving, rejecting, marking as sent,
  marking do-not-contact, retrying a failed job and signing in/out currently
  give no confirmation. Add an accessible toast surface (`aria-live`) and wire
  every Server Action and form to it, including failures.
- **Honest data states, everywhere.** A consistent treatment for loading
  (skeletons shaped like the content they replace, not grey boxes), empty
  ("no leads match these filters" with a way to clear them), error (the
  existing degraded/unreachable results rendered as a designed state, not raw
  text), and partial data — preserving the observed / inferred / unknown
  distinction that `<Fact>` and `<Evidence>` already encode.
- **Interaction polish.** Hover, focus-visible, active and disabled states on
  every interactive element; row and card hover affordances; optimistic
  pending states on submit buttons; motion (`tw-animate-css` is already a
  dependency) that is subtle, purposeful, and disabled under
  `prefers-reduced-motion`.
- **Layout and navigation.** A denser, iconified sidebar with a collapse
  control and a working mobile drawer (the sidebar is `hidden md:block` today,
  so small screens have no navigation at all), a page-header pattern with
  breadcrumbs and actions, and responsive table→card behaviour so the
  seven-column lead and company tables are usable below `md`.
- **Charts that match the theme.** Recharts styling driven from the theme
  tokens rather than defaults, with a designed tooltip, legend and empty state.

## Non-goals

Deliberately deferred, and **not** part of this change:

- **Any behaviour change.** No new data, no new endpoint, no new field, no
  change to what any page fetches or to who may do what. If a screen's
  information content changes, that is out of scope.
- **New pages or features.** The route list is exactly what exists today.
- **A component library dependency swap.** Staying on Tailwind v4 +
  `@base-ui/react` + shadcn conventions; not adopting a different kit.
- **Marketing / public-facing pages.** This is the signed-in workspace only.
- **Internationalisation and RTL.** Real work for a Middle-East product, but a
  separate change with its own translation and layout-mirroring concerns.
- **Reworking Playwright E2E coverage.** Existing specs will be kept passing
  where selectors survive; broad E2E expansion belongs with `add-deployment`.

## Capabilities

### New Capabilities

- `web-design-system`: the visual and interaction contract of the signed-in
  web workspace — theme tokens and colour semantics, light/dark preference,
  shared UI primitives, notification (toast) behaviour, the four data states
  (loading, empty, error, partial), responsive and navigation behaviour, motion
  and reduced-motion, and the accessibility floor every screen must clear.

### Modified Capabilities

None. `dashboard` and `authentication` describe *what* the workspace shows and
*who* may see it; both are still in-flight changes rather than archived specs in
`openspec/specs/`, and neither requirement set changes here — this change adds a
presentation contract alongside them rather than altering either.

## Impact

- **`apps/web/src/app/globals.css`** — palette, tokens, base layer rewritten.
- **`apps/web/src/components/ui/`** — grows from 3 primitives to ~14.
- **`apps/web/src/components/`** — every existing component restyled to consume
  primitives instead of ad-hoc classes: `header`, `sidebar`, `panel`, `fact`,
  `evidence`, `generated`, `lead-list-table`, `company-list-table`,
  `company-detail-summary`, `company-panels`, `*-filters-bar`, `filter-select`,
  `sign-in-form`, `analytics/response-rate-chart`,
  `operations/failed-jobs-table`, `outreach-review/*`, `lead-detail/*`.
- **`apps/web/src/app/(workspace)/**` and `(auth)/**`** — layouts, page headers,
  toast provider mounting, `loading.tsx` / `error.tsx` route segments.
- **Server Actions** (`outreach/review/actions.ts`, `operations/actions.ts`,
  `(auth)/sign-in/actions.ts`, `(workspace)/actions.ts`) — return a result the
  UI can toast instead of only redirecting.
- **Tests** — existing vitest component tests and `*.a11y.test.tsx` will need
  selector and snapshot updates; new tests for theme toggle, toasts and data
  states. Two Playwright specs may need selector updates.
- **Dependencies** — no new runtime dependency is expected; `lucide-react`,
  `tw-animate-css`, `class-variance-authority` and `recharts` are already
  installed. A toast primitive will be built on `@base-ui/react` rather than
  adding `sonner`.
- **No change** to `apps/api`, `packages/database`, `packages/config`, or any
  migration.
