## Context

See `proposal.md` — Why. What the reference actually is, and what that implies:

- **`template/mela/` is one 66-line client component and 35 lines of CSS.**
  `components/mela-workspace.tsx` holds every screen behind a `useState` switch;
  `app/globals.css` holds hand-written class rules — `.sidebar`, `.stat-card`,
  `.stage-rail`, `.funnel-row` — not Tailwind utilities. It is a picture of the
  product, drawn quickly and well. It is not a component library.
- **Its tokens are already ours.** The `:root` and `.dark` blocks in the mock are
  the same OKLCH values as `apps/web/src/app/globals.css`. Nothing about colour
  needs deciding; the mock inherited the palette from the prompt that produced it.
- **Its measurements are not ours.** 13px base font, 246px sidebar, 62px topbar,
  11px table cells, `color-mix(in oklch, var(--card) 65%, var(--background))`
  sidebar tint. This is the part that makes it look designed, and the part the
  app does not have.
- **The app already owns the hard components.** `Fact`, `Evidence`, `Generated`,
  `Unavailable`, `EmptyState`, `Panel` and the toast layer encode certainty,
  provenance and the four data states, and they have tests. The mock's
  equivalents are one-line stubs. The mock must not overwrite them.
- **The API cannot serve the mock's best screens.** Stat deltas, sparklines, the
  funnel, activity, attention, four analytics series, operations spend and
  rate limits, and dependency uptime history have no endpoint. Only
  `GET /api/analytics/outreach` exists among them.
- **`redesign-web-ui` is archived with its later groups unbuilt.** The specs in
  `openspec/specs/web-design-system/` describe behaviour the code partly does not
  have. This change is where that gap closes, and it must not assume the archived
  change's page-level work happened.
- **`add-pipeline-control` is active and touches one shared file** — the sidebar
  navigation list, which gains a Pipeline entry in both changes.

## Goals / Non-Goals

**Goals:**

- Every screen looks like the reference, built from the app's own tokens and
  primitives, with no second styling system.
- Every number on a redesigned screen comes from an endpoint that computed it.
- A screen built after this change matches without its author being told how.
- The reference is deleted at the end, because a mock kept alongside the app is a
  second truth that drifts.

**Non-Goals (design-level):**

- No component library change. shadcn + Tailwind v4 + `@base-ui/react` stay.
- No rewrite of `Fact`, `Evidence`, `Generated` or `Unavailable`. They are
  restyled from outside; their logic and tests are untouched.
- No charting library beyond `recharts`, already a dependency.
- No real-time transport. Where a screen needs to move, it polls.
- No pipeline behaviour. The Pipeline page's data belongs to
  `add-pipeline-control`.

## Decisions

### D1 — Translate the mock to Tailwind utilities; do not port its CSS

**The decision that shapes every task below.**

The mock's CSS is compact and could be dropped into `globals.css` in an afternoon.
That is the wrong trade. The app styles with Tailwind utilities over a token
layer, lints with Biome, and has tests asserting rendered structure. A parallel
sheet of `.stat-card` rules would mean two places to change a colour, two ways to
express spacing, and a class name that no tool can tell is unused.

So: the mock's **values** are extracted into `@theme` tokens, and its
**components** are rewritten as React components using utilities. The mock is
read, not imported.

**Cost, stated plainly:** this is slower than copying, by roughly the difference
between a day and a week. It is paid once.

**Alternative considered — keep the mock's CSS as a component layer under
`@layer components`:** rejected. It works, and it is how the codebase acquires a
second styling system that nobody later can safely delete.

### D2 — Measurements become tokens, not magic numbers

The mock's density is its best quality and its most repeated detail: 13px base,
11px in tables and metadata, 10px on labels, 30px page titles. Left as literals
these become 200 opportunities to be slightly wrong.

They are added to `@theme` as a named scale — `--text-meta`, `--text-body`,
`--text-title`, `--size-sidebar`, `--size-topbar`, `--surface-sidebar`,
`--surface-topbar` — and used by name. The design-system spec's new requirement
("the design language lives in tokens and primitives") is then checkable by
grepping page code for literal colours and sizes, which is what task 9.2 does.

### D3 — Nine new primitives, and a hard line around the ones that exist

New, because the app has no equivalent: `StatCard`, `Sparkline`, `FunnelChart`,
`StageRail`, `ActivityFeed`, `UptimeBar`, `HealthCard`, `EmailFrame`,
`CommandPalette`.

Restyled but not rewritten: `Panel`, `Card`, `Badge`, `Button`, `Table`,
`EmptyState`, `Skeleton`, `Unavailable`, `Fact`, `Evidence`, `Generated`,
`Toast`. Their props and behaviour are unchanged; only their classes move. Three
of them — `Unavailable` (via `data-state.test.tsx`), `Evidence` and `Generated` —
are among the eleven test files the workspace retains, and those tests must pass
unmodified after the restyle.

**Why the line matters:** the mock's `Badge`, `Score`, `Generated` and
`StateCard` are stubs — `StateCard` picks one of four hard-coded strings from an
object literal. `Unavailable` distinguishes degraded from unreachable and says
why. Taking the mock's version would delete the product's most important
behaviour in exchange for nicer padding.

### D4 — Read endpoints are aggregates, computed in SQL, not assembled in the web app

The dashboard needs eight numbers, a seven-point series each, a nine-stage
funnel, an activity feed and an attention list. Fetching that as fifteen
round-trips from a Server Component is how the page takes four seconds.

Each screen gets one endpoint returning one shaped response, with the counting
done by aggregate query in `packages/database/src/read/`. The web app's `lib/`
holds a typed fetch per endpoint and nothing else.

**Why not** a general query API: it would be one endpoint that can express
anything, which is one endpoint nobody can optimise, cache or reason about.

### D5 — A trend needs a comparison, and an absent comparison is stated

`{ current, previous, series }` — with `previous: null` when the preceding period
holds no data, and the series carrying its own `firstRecordedAt`.

The interface renders no delta when `previous` is null. It does not render `+100%`
or `—` styled as a value.

**Why this is a design decision and not an implementation detail:** the natural
shape is `{ count, delta }`, and the natural bug is a delta of `+100%` on a
workspace's first week, on the most prominent number on the most prominent page.
Making `previous` explicitly nullable puts the decision in the type.

### D6 — Dependency uptime is sampled and stored, or it is not shown

The mock's uptime bar — eighteen segments, mostly green — is the single most
persuasive element on the API status screen, and the app records nothing that
could fill it. Three options: fake it, drop it, or record it.

**Record it.** A `dependency_health_samples` table, one row per dependency per
probe, written by a repeatable job. The bar renders the samples that exist and
states the earliest one it holds. Before sampling begins, the bar is empty and
says so.

**Why not** derive it from logs: the log store is not queried by the API, is
redacted, and has a retention policy set for a different purpose.

**Why not** drop the bar: a status page whose only content is "operational right
now" answers the question nobody is asking.

This is the one piece of new persisted state in the change, and it is small: a
dependency name, a status, a latency, a timestamp.

### D7 — The Analytics, Operations and API Status screens are designed here

The mock renders all three from one `Supporting` component with placeholder
copy. They are the three screens the reference does not answer, and they are
where the app's least-designed pages are today.

They are designed in the same language: Analytics is four `recharts` panels over
a shared range selector; Operations is `HealthCard` plus queue depth, failed jobs
and the spend panel; API Status is `HealthCard` plus `UptimeBar` per dependency.
No new visual vocabulary is invented for them.

### D8 — Sidebar counts are read separately and degrade to nothing

The outreach-review badge needs a count on every page. Blocking every page's
render on it would make one slow read slow the whole app.

It is fetched in the layout with the standard timeout, and on failure renders
**no badge** — not a zero, which would falsely say the queue is empty.

### D9 — `template/mela/` is excluded, then deleted

For the duration it stays as reference and is excluded from `pnpm-workspace.yaml`
(already true — the globs are `apps/*` and `packages/*`), from Biome's ignore
list, and from the root `tsconfig`. The final group deletes it.

**Why delete rather than keep:** a mock that stays becomes the thing people open
to see how a screen should look, six months after the app diverged from it. The
design's permanent home is the tokens, the primitives and this spec.

## Risks / Trade-offs

- **This is a large change touching every page.** → Groups are ordered so each
  ends with something usable: tokens and primitives first, then one page per
  group, each independently shippable. A group can be paused between pages
  without leaving the app half-styled, because the primitives land first.
- **Restyling `Fact`, `Evidence` and `Unavailable` risks weakening exactly the
  behaviour the product exists for.** → `Evidence`, `Generated` and
  `data-state.test.tsx` survive in the retained suite and are not modified here;
  a change to those test files signals the restyle went too far. `Fact` has no
  test left, so task 9.1 checks it by diff instead.
- **The new endpoints are aggregate queries over growing tables** → each is
  written against the indexes that exist, and task 8.6 measures them against the
  seeded dataset rather than assuming.
- **Density at 13px base risks failing the accessibility floor** → the contrast
  test was among the files removed when the suite was cut to 45 cases, so task
  1.7 checks the new token pairs by hand and records the ratios in
  `docs/architecture.md`, where a later reader can re-check them. The 11px
  metadata scale is restricted to supporting text that duplicates something
  legible, never to the only statement of a fact.
- **Two active changes both edit the sidebar navigation list** → it is a single
  array in `apps/web/src/components/navigation.ts`; whichever lands second adds
  one entry. Called out here so it is a merge, not a surprise.
- **A funnel, a spend meter and an uptime bar are three new ways to draw a
  number that is not what it appears to be** → each carries a stated rule in the
  `workspace-insights` spec, and each has a scenario asserting the dishonest
  rendering does not happen.

## Migration Plan

One migration adding `dependency_health_samples`. No existing table changes, so
there is nothing to backfill and nothing to reverse beyond dropping it.

No API contract is removed. The eight new endpoints are additions; the existing
`GET /api/analytics/outreach` keeps its shape and its consumer.

Rollout is the group order below. Tokens and primitives land first because every
page depends on them; the read endpoints land before the pages that consume them
so no page is ever built against a shape that does not exist yet.

`template/mela/` is deleted in the last group, after the final verification pass,
so the reference is available for comparison until the work it describes is done.

## Open Questions

- **Whether the sparkline window is seven or thirty days.** Shipped as seven,
  matching the reference. The endpoint takes the window as a parameter, so
  changing it is a call-site edit rather than a redesign.
- **How often dependency health is probed.** Shipped at one minute, which fills
  a 90-segment bar in an hour and a half and costs one small row per dependency
  per minute. If retention becomes a question, the answer is a prune job in
  `add-background-jobs`, not a change to the shape.
- **Whether the command palette should also run actions, not just find records.**
  Deferred. Finding a company is the use that justifies the shortcut; commands
  can be added to the same surface later without changing what exists.
