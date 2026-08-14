## 1. Tokens, density and the reference's exclusion

- [x] 1.1 Add `template/` to Biome's `files.ignore` and to the root `tsconfig.json` excludes, so the reference never enters lint, type-check or build (design D9) — there is no root `tsconfig.json`; every package carries its own and Turborepo runs `typecheck`/`build` per workspace package, so `template/mela` is already outside both. Biome was the only tool that reached it. `pnpm exec biome check template` now reports "No files were processed in the specified paths"
- [x] 1.2 Confirm `pnpm install` does not pick up `template/mela` — the workspace globs are `apps/*` and `packages/*`; add an explicit exclusion only if it does — `pnpm ls -r --depth -1` lists seven packages, none of them the reference. No exclusion needed
- [x] 1.3 Add the density scale to `@theme` in `globals.css` — `--text-label`, `--text-meta`, `--text-body`, `--text-heading`, `--text-title` (10/11/13/15/30px) with their line heights (design D2) — written in rem against a 16px root rather than px, so a reader who enlarges text still gets what they asked for; the px each rung renders at the browser default is recorded beside it. `--tracking-eyebrow` added alongside, so the eyebrow's 0.12em is a name rather than an arbitrary value task 9.2 would later have to find
- [x] 1.4 Add the layout tokens — `--size-sidebar` 246px, `--size-sidebar-collapsed` 72px, `--size-topbar` 62px, `--size-content-max` 1500px — declared in `:root` rather than `@theme`, because nothing generates a utility from them and Tailwind v4 tree-shakes theme variables it cannot see used; they are read as `w-(--size-sidebar)`, the same way `--radius` and the elevations already are
- [x] 1.5 Add the surface recipes — `--surface-sidebar` and `--surface-topbar` as the reference's `color-mix` values, in both themes — declared once in `:root` and mapped into `@theme inline` as `--color-surface-*`. Both are mixes of `--card` and `--background`, which are redefined per theme on that same element, so one declaration resolves correctly in both and a second copy under `.dark` could only drift
- [x] 1.6 Set the app's base font size and heading family to the scale, replacing whatever each page sets for itself — `body` takes `text-body`, `h1` takes `text-title`, `h2`/`h3` take `text-heading`, all at the reference's -0.035em tracking. `PageHeader`'s `text-2xl`/`tracking-tight` on the page `h1` was the one place a size was set outside the scale and is now removed; the primitives and pages that still set their own sizes are rebuilt in groups 2, 3, 6 and 7
- [x] 1.7 Check every new token pair against WCAG AA at the size it is used, in both themes, and record the ratios in `docs/architecture.md` — every text pair on the two new surfaces clears 4.5:1 (lowest 5.76:1), every non-text pair clears 3:1 (lowest 3.15:1). `border` on the new surfaces is 1.44–1.68:1, decorative and matching `border` on `background`/`card`. The two surfaces were added to `src/lib/theme-tokens.ts` so the mirror stays complete, and that file's docstring now says the contrast test was deleted rather than claiming it still guards the values
- [x] 1.8 Verify: `pnpm --filter @mela/web lint`, `typecheck` — both clean (130 files checked, no diagnostics). `pnpm --filter @mela/web build` also run, because a missing `@theme` rung would only surface when Tailwind compiles `@apply text-body`; 12/12 routes generated

## 2. New primitives

- [ ] 2.1 Add `ui/sparkline.tsx` — a `recharts` line over a series, rendering nothing and saying so when the series is empty (design D5)
- [ ] 2.2 Add `ui/stat-card.tsx` — label, value, delta and sparkline, rendering **no delta** when the previous period is null (spec: a delta with nothing to compare against is absent)
- [ ] 2.3 Add `ui/funnel-chart.tsx` — a labelled row per stage with a proportional bar, rendering a not-yet-run stage distinctly from a zero (spec: a stage that never ran is not a zero)
- [ ] 2.4 Add `ui/stage-rail.tsx` — the vertical stage list with per-stage state, count and progress, for the pipeline and company detail screens
- [ ] 2.5 Add `ui/activity-feed.tsx` — tone-coded entries with actor, subject and time, showing no actor for a system event (spec: a system event has no actor)
- [ ] 2.6 Add `ui/uptime-bar.tsx` — one segment per sample, with unrecorded segments visually distinct from healthy ones (spec: the unsampled past is not filled in)
- [ ] 2.7 Add `ui/health-card.tsx` — dependency name, status line, tone badge and optional uptime bar
- [ ] 2.8 Add `ui/email-frame.tsx` — the addressed message frame used by outreach review, accepting evidence-marked children
- [ ] 2.9 Add `ui/command-palette.tsx` on `@base-ui/react` — opens on `⌘K`/`Ctrl+K`, returns focus on dismiss, states a no-match in words (spec: search opens from the keyboard, nothing matches)
- [ ] 2.10 Restyle `Panel`, `Card`, `Badge`, `Button`, `Table`, `EmptyState`, `Skeleton`, `Toast` to the reference, changing classes only — no prop or behaviour changes (design D3)
- [ ] 2.11 Restyle `Fact`, `Evidence`, `Generated`, `Unavailable` from the outside only — classes change, logic does not (design D3)
- [ ] 2.12 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit` — the retained `data-state`, `evidence` and `generated` tests must still pass unmodified

## 3. The shell

- [ ] 3.1 Rebuild `sidebar.tsx` — brand, account block, nav with per-entry icon, active marking via `aria-current`, and the collapsed icon rail (spec: the current destination is marked)
- [ ] 3.2 Add the collapse control and persist the choice in a cookie read server-side, matching the theme's existing pattern (spec: the collapse choice persists)
- [ ] 3.3 Add the outreach-review count to its nav entry, fetched in the layout, rendering **no badge** when the count cannot be read (design D8, spec: an unread count is not guessed)
- [ ] 3.4 Rebuild `mobile-nav.tsx` as the drawer opened from the top bar below the tablet breakpoint (spec: small screens get a drawer)
- [ ] 3.5 Rebuild `header.tsx` — breadcrumb, search trigger with its shortcut hint, notifications, account with role visible without opening a menu (spec: the role is legible)
- [ ] 3.6 Wire `CommandPalette` to `GET /api/search` with debounce, grouped results and keyboard navigation
- [ ] 3.7 Rebuild `ui/page-header.tsx` to the eyebrow/title/detail/action composition every page uses (spec: a page identifies itself)
- [ ] 3.8 Verify: `pnpm --filter @mela/web lint`, `typecheck`

## 4. Aggregate read endpoints

- [ ] 4.1 Add `packages/database/src/read/insights.ts` — aggregate queries for headline counts with their preceding period and daily series (design D4)
- [ ] 4.2 Add the funnel query — companies by furthest stage reached, distinguishing a stage that never ran (spec: a stage that never ran is not a zero)
- [ ] 4.3 Add the activity query over the audit trail and stage records, with a nullable actor (spec: a system event has no actor)
- [ ] 4.4 Add the attention query — drafts awaiting review, re-runnable failures, stale leads, as one ordered list
- [ ] 4.5 Add `apps/api/src/dashboard/` with `GET /api/dashboard/summary`, `/funnel`, `/activity`, `/attention`, all open to any signed-in role (spec: a viewer sees the workspace)
- [ ] 4.6 Return `previous: null` and `series.firstRecordedAt` rather than a computed delta when the preceding period holds nothing (design D5, spec: the first period has nothing to compare against)
- [ ] 4.7 Add `GET /api/analytics/discovery`, `/scores`, `/conversion`, `/spend`, each carrying its sample size and marking buckets below the configured minimum (spec: a small bucket is marked)
- [ ] 4.8 Return an empty window as a stated empty rather than a series of zeroes (spec: an empty window is empty, not zero)
- [ ] 4.9 Add `GET /api/operations/spend` — amount, period, ceiling in force, remaining, and a per-stage breakdown (spec: spend is anchored)
- [ ] 4.10 Add `GET /api/operations/rate-limits` — configured limit and current usage per discovery and analysis source
- [ ] 4.11 Add `GET /api/search` — companies and leads by name and domain, grouped by kind, capped and ordered by match quality
- [ ] 4.12 Exercise every endpoint by hand against the seeded database and confirm each response shape, including the null-previous case, the partial-series case, the not-run stage, the below-minimum bucket and the empty window
- [ ] 4.13 Verify: `pnpm --filter @mela/api lint`, `typecheck`

## 5. Dependency health sampling

- [ ] 5.1 Add `dependency_health_samples` to `packages/database/src/schema/` — dependency, status, latency, sampled-at (design D6)
- [ ] 5.2 Generate and apply the migration
- [ ] 5.3 Add write and read helpers, the read returning the earliest sample it holds alongside the window
- [ ] 5.4 Add the repeatable probe writing one sample per dependency per minute, reusing the existing health checks rather than duplicating them
- [ ] 5.5 Add `GET /api/health/history` returning samples with unrecorded periods marked, never interpolated (spec: a gap in sampling is visible)
- [ ] 5.6 Confirm by hand: a window reaching before the first sample reports the earlier part as unrecorded, and a sampling gap is left as a gap
- [ ] 5.7 Verify: `pnpm --filter @mela/api lint`, `typecheck`

## 6. Dashboard, Leads and Companies

- [ ] 6.1 Add `lib/insights.ts`, `lib/search.ts` — typed fetches for the group 4 endpoints
- [ ] 6.2 Rebuild the dashboard — four `StatCard`s, the `FunnelChart` panel, `ActivityFeed`, and the attention list, each panel handling its own four data states
- [ ] 6.3 Show the attention list's empty case as "the workspace is clear", not an empty container (spec: nothing needs attention)
- [ ] 6.4 Rebuild the leads list — the reference's filter bar with removable chips, dense table, score badge, evidence with its certainty, and the filtered-vs-nothing-yet empty states already in `lead-list-table.tsx`
- [ ] 6.5 Rebuild lead detail — score breakdown with per-factor evidence, generated summary marked as generated, contacts with certainty, and the stage timeline on `StageRail`
- [ ] 6.6 Rebuild the companies list and its filter bar to match leads, sharing the table primitives rather than duplicating them
- [ ] 6.7 Rebuild company detail — tabbed Overview, Website analysis, Technology, Contacts, Opportunities, History, each tab keeping its own data state
- [ ] 6.8 Rebuild `companies/needs-attention` in the same language, each row naming the failure and offering the action that resolves it
- [ ] 6.9 Update `loading.tsx` skeletons on all five routes to match the new layouts' shapes
- [ ] 6.10 Walk all five routes against the seeded database and confirm each panel's four data states render distinctly
- [ ] 6.11 Verify: `pnpm --filter @mela/web lint`, `typecheck`

## 7. Outreach review, Analytics, Operations, API Status, Sign in

- [ ] 7.1 Rebuild outreach review — queue on the left, draft on the right in `EmailFrame`, with the evidence strip naming the model and the citation count
- [ ] 7.2 Keep the approval gate explicit: the confirm step, and the stated "approval does not send" note the reference carries (spec: nothing in the interface sends a message)
- [ ] 7.3 Rebuild analytics — four `recharts` panels over a shared range selector, each with legend, accessible labels and its own empty and unavailable states (design D7)
- [ ] 7.4 Mark buckets below the minimum sample distinctly, and render a withheld rate as withheld rather than as zero (spec: a rate is withheld rather than misleading)
- [ ] 7.5 Rebuild operations — `HealthCard`s, queue depth, failed jobs with retry, the spend panel against its ceiling, and rate-limit status per source
- [ ] 7.6 Rebuild api-status — `HealthCard` plus `UptimeBar` per dependency, stating the earliest sample held, and incident notes
- [ ] 7.7 Rebuild sign-in — split layout, inline field errors, and the product statement panel
- [ ] 7.8 Update `error.tsx` and `loading.tsx` on the affected routes to the new language
- [ ] 7.9 Verify: `pnpm --filter @mela/web lint`, `typecheck`

## 8. Responsiveness, accessibility and performance

- [ ] 8.1 Walk every rebuilt page from 375px to 2560px, confirming tables become card lists below the tablet breakpoint
- [ ] 8.2 Walk every page by keyboard alone, confirming a visible focus ring on every control and that the palette returns focus on dismiss
- [ ] 8.3 Run the browser's accessibility audit over each rebuilt page and resolve what it reports
- [ ] 8.4 Confirm no state is signalled by colour alone — each tone pairs with a label or an icon
- [ ] 8.5 Confirm reduced-motion is honoured by every new animation and the polling indicator
- [ ] 8.6 Measure the four dashboard endpoints and the two list endpoints against the seeded dataset; add an index for any query that scans (design risks)

## 9. Guardrails and completion

- [ ] 9.1 Confirm `Fact`, `Evidence`, `Generated` and `Unavailable` differ from the start of this change only in their class names
- [ ] 9.2 Grep every page-level file for a literal hex, `oklch(`, `px` font size or `box-shadow`, and move any hit into a token (spec: a screen carries no bespoke styling)
- [ ] 9.3 Confirm no screen renders a bare zero where a not-run, produced-nothing, degraded or unreachable state applies
- [ ] 9.4 Confirm no delta, sparkline, funnel bar, spend meter or uptime segment renders a value the API did not return
- [ ] 9.5 Delete `template/mela/` and remove its tooling exclusions (design D9, spec: the reference is retired)
- [ ] 9.6 Update `docs/architecture.md` with the design-system section — tokens, the density scale, the primitive inventory, the contrast ratios from 1.7, and the aggregate read surface
- [ ] 9.7 Update `docs/development.md` with how to add a screen without introducing a bespoke value
- [ ] 9.8 Add `adopt-workspace-design` to the roadmap table in `docs/implementation-progress.md`, noting it completes `redesign-web-ui` groups 8–13
- [ ] 9.9 Verify the whole workspace: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- [ ] 9.10 Run `openspec validate adopt-workspace-design --strict` and resolve anything it reports
