## Why

`template/mela/` now holds a v0-generated mock of the whole workspace — sidebar,
topbar, dashboard, pipeline, leads, companies, outreach review and the supporting
pages — built on the same OKLCH tokens the app already ships. It is the first
concrete answer to "what should this look like", and it is materially better than
what renders today.

Two facts make this change necessary rather than cosmetic:

1. **`redesign-web-ui` was archived with groups 8–13 unimplemented.** Its
   checkboxes were ticked to allow the archive, not because the work was done.
   The dashboard, analytics, leads, companies, outreach review and operations
   pages still carry pre-redesign markup. This change re-opens exactly that work,
   now with a reference design to build against instead of a description.
2. **The mock's best screens need data the API cannot serve.** Stat cards show a
   delta against the previous period and a seven-point sparkline; the app has
   `GET /api/companies/count` and nothing else. The pipeline funnel, the activity
   feed, the attention list, the analytics charts, the operations spend panel and
   the API-status uptime bars have no endpoint at all. Building the design without
   the reads behind it would produce screens that can only be honest by being
   empty.

The mock is a single 66-line client component with 35 lines of hand-written CSS.
It is a reference, not a codebase. This change extracts its design language into
the app's existing Tailwind v4 + shadcn component system, and builds the reads
that let each screen show something true.

**Roadmap coverage:** completes the unfinished half of `redesign-web-ui` (11),
and extends `dashboard` (7) and `observability` (13) with the aggregate reads
their screens have always implied.

## What Changes

**A design language, extracted rather than copied**

- The mock's measurements become tokens: a 13px base scale, a 246px sidebar, a
  62px topbar, the `color-mix` surface tints, the panel border-and-shadow recipe.
- New primitives the app does not have: `StatCard` with sparkline and delta,
  `FunnelChart`, `StageRail`, `ActivityFeed`, `UptimeBar`, `HealthCard`,
  `EmailFrame`, `WorkspaceSwitcher`, `CommandPalette`.
- Existing primitives (`Panel`, `Badge`, `Button`, `Card`, `EmptyState`,
  `Unavailable`, `Fact`, `Evidence`, `Generated`, `Skeleton`, `Table`) keep their
  names and behaviour and gain the mock's visual treatment. Nothing that carries
  certainty or provenance is re-implemented.
- The mock's plain CSS is **not** ported. It is translated to Tailwind utilities
  against the existing token layer, so the app keeps one styling system.

**Every page rebuilt against the reference**

- Shell: collapsible sidebar with nav badges, topbar with breadcrumb, `⌘K`
  search, notifications and account menu.
- Dashboard, Leads, Lead detail, Companies, Company detail, Needs attention,
  Outreach review, Analytics, Operations, API status, Sign in.
- The mock leaves Analytics, Operations and API Status as one placeholder
  component. Those three are designed here in the same language.

**The reads those pages need**

- `GET /api/dashboard/summary` — each headline count with its previous-period
  value and a daily series, so a delta and a sparkline are real numbers.
- `GET /api/dashboard/funnel` — companies by furthest stage reached.
- `GET /api/dashboard/activity` — recent workspace events from the audit trail.
- `GET /api/dashboard/attention` — drafts awaiting review, failed stages and
  stale leads in one list.
- `GET /api/analytics/discovery`, `/scores`, `/conversion`, `/spend` — the four
  chart series the Analytics page shows.
- `GET /api/operations/spend` and `/rate-limits` — the two panels the mock's
  Operations screen implies.
- `GET /api/health/history` — dependency status samples, so the uptime bar shows
  a record rather than a decoration.
- `GET /api/search` — companies and leads by name or domain, for `⌘K`.

**Honesty carried into every new surface**

- A sparkline with fewer points than its window says so rather than drawing a
  shorter line as if that were the whole period.
- A delta against a period with no prior data is absent, not `+100%`.
- An uptime bar shows only the range actually sampled, and states when sampling
  began.
- A funnel stage that has not run is distinct from one that ran and found
  nothing — the same rule `Unavailable` already enforces.

## Non-goals

- **No new pipeline behaviour.** `add-pipeline-control` owns starting runs and
  the stage processors. This change designs the Pipeline page's *appearance*;
  its data comes from that change.
- **No multi-tenancy.** The mock's workspace switcher is styled as an account
  menu, because there is one workspace.
- **No sending.** The outreach review screen keeps the approval gate and the
  explicit "approval does not send" statement.
- **No component library swap.** shadcn + Tailwind v4 + `@base-ui/react` stay.
- **`template/mela/` is not built, linted or deployed.** It is reference material
  excluded from the workspace, and it is deleted at the end of this change.

## Capabilities

### New Capabilities

- `workspace-shell`: the application chrome — navigation, topbar, command
  palette, page composition and the density scale every screen is measured on.
- `workspace-insights`: the aggregate read surface behind the dashboard,
  analytics, operations and status screens, including how each one reports a
  period with insufficient data rather than inventing a trend.

### Modified Capabilities

- `web-design-system`: gains a stated density scale and a requirement that the
  design language is defined by tokens and primitives rather than per-page
  styling, so a screen built later matches without being told to.

## Impact

- **`apps/web/src/app/globals.css`** — density scale, surface recipes, the
  measurements the mock establishes.
- **`apps/web/src/components/ui/`** — nine new primitives; existing ones restyled.
- **`apps/web/src/app/(workspace)/**`** — every page rebuilt; three new routes
  (`analytics` redesigned, `search`, `pipeline` handed to the other change).
- **`apps/web/src/lib/`** — typed fetches for eight new endpoints.
- **`apps/api/src/dashboard/`** (new) — summary, funnel, activity, attention.
- **`apps/api/src/analytics/`** — four series endpoints alongside the existing
  outreach aggregate.
- **`apps/api/src/operations/`** — spend and rate-limit reads.
- **`apps/api/src/health/`** — dependency sampling and history.
- **`packages/database/`** — one table, `dependency_health_samples`, and read
  helpers for the aggregate queries.
- **`template/mela/`** — excluded from tooling for the duration, deleted at the
  end.
- **Depends on** nothing. Runs alongside `add-pipeline-control`; the only shared
  file is the sidebar's navigation list.
