## 1. Theme foundation

- [x] 1.1 Rewrite the `:root` palette in `apps/web/src/app/globals.css` with the OKLCH scale from design D2 — branded primary, lifted `--card` over `--background`, tinted neutrals — replacing every chroma-zero value
- [x] 1.2 Rewrite the `.dark` palette to match, keeping the same hue and chroma per role at dark-mode lightness
- [x] 1.3 Add the semantic status tokens (`--success`, `--warning`, `--info`, `--danger` and each one's `-foreground` / `-subtle`) to `:root`, `.dark` and the `@theme inline` mapping, aliasing `--danger` onto the existing `--destructive` hue
- [x] 1.4 Replace `--chart-1` … `--chart-5` with the five-hue ramp, matched for lightness and chroma so adjacent series stay distinguishable
- [x] 1.5 Add the motion duration tokens (`--duration-fast|base|slow`) and the global `@media (prefers-reduced-motion: reduce)` block that collapses transition and animation durations (design D11)
- [x] 1.6 Add `apps/web/src/lib/theme-tokens.ts` exporting the token definitions as data, and `theme-contrast.test.ts` asserting WCAG AA (4.5:1 text, 3:1 non-text) for every foreground/background pair in both themes (design D13)
- [x] 1.7 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit` — the app renders with the new palette and no component has changed yet

## 2. Status semantics

- [x] 2.1 Add `apps/web/src/lib/status-tone.ts` mapping lead priority, lead status, outreach status, staleness, job state and health onto `success | warning | danger | info | neutral` (design D3)
- [x] 2.2 Add `status-tone.test.ts` covering every domain value, including that an unrecognised value falls back to `neutral` rather than throwing
- [x] 2.3 Verify: `pnpm --filter @mela/web test:unit`

## 3. UI primitives

- [x] 3.1 Restyle `components/ui/button.tsx` for the new tokens and add the full hover / focus-visible / active / disabled / pending state set (spec: consistent interactive states)
- [x] 3.2 Add `components/ui/card.tsx` (root, header, title, description, content, footer)
- [x] 3.3 Add `components/ui/badge.tsx` driven by a `tone` prop from task 2.1, never a colour, with text as well as colour carrying the meaning (spec: status is not carried by colour alone)
- [x] 3.4 Add `components/ui/table.tsx` — the presentational table shell (container, header, row, cell) with hover and zebra treatment
- [x] 3.5 Add `components/ui/skeleton.tsx` with `TableSkeleton`, `CardSkeleton`, `StatSkeleton` and `ChartSkeleton` variants, each `aria-hidden` inside an `aria-busy` container (design D8)
- [x] 3.6 Add `components/ui/input.tsx` and `components/ui/label.tsx` with error and description slots wired for accessible naming
- [x] 3.7 Add `components/ui/dialog.tsx` and `components/ui/tooltip.tsx` on `@base-ui/react`, with focus trap, `Escape` to close and return-focus behaviour
- [x] 3.8 Add `components/ui/tabs.tsx` and `components/ui/separator.tsx`
- [x] 3.9 Add `components/ui/empty-state.tsx` taking a title, description, optional icon and optional action, and distinguishing the filtered case from the nothing-yet case (spec: empty state)
- [x] 3.10 Add `components/ui/page-header.tsx` — title, description, breadcrumb slot, action slot
- [x] 3.11 Restyle `components/ui/popover.tsx` and `components/ui/select.tsx` onto the new tokens and interactive states
- [x] 3.12 Add co-located unit tests for `badge` (tone → accessible text), `empty-state` (both cases), `skeleton` (hidden from assistive technology) and `dialog` (focus trap, `Escape`)
- [x] 3.13 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit`

## 4. Notifications

- [x] 4.1 Check whether the installed `@base-ui/react` 1.7.0 exports a `Toast` primitive and record which branch of design D5 is taken in a comment at the top of `components/ui/toast.tsx`
- [x] 4.2 Implement `components/ui/toast.tsx` — provider, bounded queue, portal viewport, per-toast dismiss timer, manual dismiss control, and `success` / `error` / `info` tones
- [x] 4.3 Put the viewport in a live region — `polite` for success and info, `assertive` for error — and confirm focus is never moved to it (spec: notifications reach assistive technology)
- [x] 4.4 Mount the toast provider in `app/(workspace)/layout.tsx` and `app/(auth)/layout.tsx`
- [x] 4.5 Add `apps/web/src/lib/action-result.ts` defining the `ActionResult` shape and helpers, and `lib/use-toast-on-action-result.ts` raising a toast when a `useActionState` result changes (design D6)
- [x] 4.6 Add the flash-cookie path for actions that redirect — set on the server, read once and cleared by the destination layout, handed to the provider as an initial toast
- [x] 4.7 Add tests: the queue is bounded and drops oldest, each toast dismisses after its interval, manual dismiss works, an error toast lands in an assertive region, and the flash cookie is read exactly once
- [x] 4.8 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit`

## 5. Provenance components

- [x] 5.1 Restyle `components/fact.tsx` so an unknown value stays visibly distinct from zero, from an empty string and from a loading placeholder (spec: an unknown value is not shown as a blank)
- [x] 5.2 Restyle `components/evidence.tsx` so inferred values keep a visible marker and their source stays reachable
- [x] 5.3 Restyle `components/generated.tsx` so AI-generated text stays visibly labelled and does not read as an observed fact
- [x] 5.4 Extend the existing `fact`, `evidence` and `generated` tests to assert the certainty distinctions survive the restyle, updating selectors rather than removing assertions
- [x] 5.5 Verify: `pnpm --filter @mela/web test:unit`

## 6. Application shell

- [x] 6.1 Add the theme cookie: read it in `app/layout.tsx` and write `class="dark"` plus `color-scheme` onto `<html>` during server rendering (design D4)
- [x] 6.2 Add the `system` path — no class written, with `.dark` styles additionally selected by `@media (prefers-color-scheme: dark)` so the OS preference works with no JavaScript
- [x] 6.3 Add `components/ui/theme-toggle.tsx` — a client control cycling light / dark / system, applying the change immediately and persisting it via a Server Action
- [x] 6.4 Restyle `components/header.tsx`: page-level actions, the theme toggle, and the account's email, role and sign-out control kept exactly as they are today
- [x] 6.5 Rebuild `components/sidebar.tsx` as icon + label with a persisted collapsed state and the active-route treatment (design D10)
- [x] 6.6 Add the mobile navigation drawer — opened from a header control, closing on route change and `Escape`, focus trapped while open (spec: navigation on a small screen)
- [x] 6.7 Restyle `app/(auth)/layout.tsx` and the sign-in page, and wire `components/sign-in-form.tsx`'s existing `useActionState` result to a toast on failure
- [x] 6.8 Restyle `components/panel.tsx`'s error state onto the designed error treatment, keeping its Suspense and error-boundary structure unchanged
- [x] 6.9 Add tests: the theme cookie round-trips and renders the right class on first paint, the toggle cycles all three states, the drawer opens and closes by keyboard, and the header still shows the account and sign-out control
- [x] 6.10 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit`

## 7. Data-state coverage

- [x] 7.1 Replace `panel.tsx`'s single grey `PanelSkeleton` with the shaped skeleton matching each caller's content, passed through the existing `fallback` prop (design D8)
- [x] 7.2 Add `loading.tsx` to each route segment under `app/(workspace)` for whole-page waits
- [x] 7.3 Add `error.tsx` to each route segment rendering the designed error state with a retry control (spec: error and degraded state)
- [x] 7.4 Render `fetchWithTimeout`'s `degraded` result visibly differently from `unreachable` everywhere it is consumed, without changing the result shape
- [x] 7.5 Replace every bare "no results" string with `EmptyState`, distinguishing filtered from nothing-yet and offering a clear-filters control in the filtered case
- [x] 7.6 Add tests for the loading, empty, filtered-empty, degraded and unreachable states of at least one list page and one panel page
- [x] 7.7 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit`

## 8. Dashboard and analytics

- [x] 8.1 Rebuild the dashboard stat cards in `app/(workspace)/page.tsx` on `Card`, with tone, trend affordance and a shaped `StatSkeleton`, keeping the same four fetches
- [x] 8.2 Add `lib/chart-theme.ts` resolving chart, grid, axis and tooltip colours from the CSS variables at render time (design D12)
- [x] 8.3 Restyle `components/analytics/response-rate-chart.tsx` onto the chart theme, with a shared themed tooltip and legend
- [x] 8.4 Add the chart empty state for when a series has no data
- [x] 8.5 Restyle `app/(workspace)/analytics/page.tsx` with the page-header pattern
- [x] 8.6 Update `response-rate-chart.test.tsx` for the restyle and add a test that the chart re-reads its colours per theme
- [x] 8.7 Verify: `pnpm --filter @mela/web test:unit`

## 9. Leads and companies

- [x] 9.1 Rebuild `components/lead-list-table.tsx` on the `Table` primitive, replacing the hard-coded `bg-amber-100 … dark:bg-amber-900/40` staleness pill with a tone-driven `Badge`
- [x] 9.2 Rebuild `components/company-list-table.tsx` the same way
- [x] 9.3 Add the responsive card presentation for tables with more than four columns, built from one shared row definition (design D9)
- [x] 9.4 Restyle `components/lead-filters-bar.tsx`, `company-filters-bar.tsx` and `filter-select.tsx`, adding a visible active-filter count and a clear-all control
- [x] 9.5 Restyle `app/(workspace)/leads/page.tsx` and `companies/page.tsx` with the page-header pattern
- [x] 9.6 Restyle `components/company-detail-summary.tsx` and `company-panels.tsx`, keeping the do-not-contact attribution display intact
- [x] 9.7 Restyle `components/lead-detail/contact-list.tsx`, `opportunity-list.tsx`, `technology-list.tsx` and `research-summary-view.tsx`
- [x] 9.8 Restyle the lead and company detail pages and `companies/needs-attention/page.tsx`
- [x] 9.9 Update the affected component tests — `lead-list-table`, `company-list-table`, `company-detail-summary`, `contact-list`, `opportunity-list`, `technology-list`, `research-summary-view` — updating selectors, never deleting assertions
- [x] 9.10 Add a test that the responsive card presentation shows the same cells as the table row for the same data (design D9)
- [x] 9.11 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit`

## 10. Outreach review

- [x] 10.1 Rebuild `components/outreach-review/message-review-card.tsx` on `Card` and `Badge`, preserving every `canApprove` role gate exactly as it is today
- [x] 10.2 Restyle `components/outreach-review/cited-facts-panel.tsx` so each cited fact keeps its certainty marker and its evidence link
- [x] 10.3 Restyle the review queue and the review detail page with the page-header pattern and an empty state for an empty queue
- [x] 10.4 Make `app/(workspace)/outreach/review/actions.ts` return an `ActionResult` and wire approve, reject and record-as-sent to toasts, including the role-refusal message (spec: a refused action explains itself)
- [x] 10.5 Add a confirmation dialog for reject and for record-as-sent, with a pending state on the submitting control that prevents a double submit
- [x] 10.6 Diff every `canApprove` and role reference in the review area before and after, and confirm the existing gating tests in `message-review-card.test.tsx` still pass unmodified
- [x] 10.7 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit`

## 11. Operations and status

- [x] 11.1 Restyle `components/operations/failed-jobs-table.tsx` on the `Table` primitive with tone-driven job-state badges and the responsive card presentation
- [x] 11.2 Make `app/(workspace)/operations/actions.ts` return an `ActionResult` and wire retry to success and failure toasts
- [x] 11.3 Restyle `app/(workspace)/operations/page.tsx` and `api-status/page.tsx`, with health shown through the semantic tones
- [x] 11.4 Update `failed-jobs-table.test.tsx` for the restyle and add a test that a failed retry raises an error toast
- [x] 11.5 Verify: `pnpm --filter @mela/web lint`, `typecheck`, `test:unit`

## 12. Accessibility and responsiveness

- [x] 12.1 Extend the `vitest-axe` setup so each existing `*.a11y.test.tsx` fixture runs twice, once per theme (spec: automated checks pass in both themes)
- [x] 12.2 Add a11y coverage for the pages that have none — dashboard, analytics, operations, companies list, sign-in
- [x] 12.3 Audit every page for one `main` landmark, a single `h1` and a correct heading order, and fix what fails
- [x] 12.4 Walk every page by keyboard alone and fix any control that is unreachable, has no visible focus indicator, or traps focus unintentionally
- [x] 12.5 Check every page at a small viewport width and confirm the page body does not scroll horizontally and navigation is reachable
- [x] 12.6 Confirm no component declares a literal colour — grep `src/` for hex, `rgb(` and `oklch(` outside `globals.css` and `theme-tokens.ts` (spec: no component hard-codes a colour)
- [x] 12.7 Verify: `pnpm --filter @mela/web test:unit`

## 13. Regression guard and completion

- [x] 13.1 Enumerate the routes under `app/` and confirm they are exactly the routes that existed before the redesign — none added, removed or renamed (spec: the route list is unchanged)
- [x] 13.2 Diff each page's fetch calls against the pre-redesign version and confirm no fetch was added, removed or changed
- [x] 13.3 Run the two existing Playwright specs and repair only the selectors the restyle broke, adding no new specs (proposal — Non-goals)
- [x] 13.4 Update `docs/architecture.md` with the design-system section — tokens, tones, primitives, the four data states — and `README.md` with the theme preference
- [x] 13.5 Add `redesign-web-ui` to the roadmap table in `docs/implementation-progress.md`
- [x] 13.6 Verify the whole workspace: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- [x] 13.7 Run `openspec validate redesign-web-ui --strict` and resolve anything it reports
