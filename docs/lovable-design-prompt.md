# Lovable design prompt

Paste the block below into Lovable as the initial prompt. It describes the app,
the design language, every screen, and the data-honesty rules the product is
organised around. It asks for a **frontend design only** — no backend, no auth,
no database.

---

Build a polished, professional dark-and-light B2B web application called **Mela** — an AI lead-generation workspace for a solo agency operator selling web development services to businesses in the Middle East.

This is a **frontend design and prototype only**. Use mocked/static data. Do not build a backend, database, or authentication. I will wire it to my own API later.

## What the product does

The operator picks a territory (country + city) and an industry, presses one button, and the system runs a nine-stage pipeline:

`discovery → website verification → website analysis → technology detection → opportunity analysis → contact research → scoring → research summary → outreach draft → STOP`

It finds companies, analyses their websites for weaknesses (slow, outdated stack, no mobile support, poor SEO), scores them as leads, and drafts a personalised outreach message. **It never sends anything.** The chain always stops at a draft awaiting human approval. That is the product's core principle, and the UI must make it feel deliberate and reassuring, never like a missing feature.

## The single most important design principle: honest data

This app's whole value is that a human can trust what it shows. Every number, claim and empty space must say where it came from. Design for this explicitly:

1. **Never render a bare `0` or an empty table without saying which kind of nothing it is.** These four states must look visibly different from each other:
   - **Not run yet** — neutral, dashed outline, muted "Not yet analysed" copy
   - **Ran and found nothing** — a real, confident zero with a short explanation ("Analysed 12 pages, no contact details published")
   - **Degraded** — amber/warning tone: "The source responded, so the rest of this page is current. This panel is stale."
   - **Unreachable** — red/danger tone: "Nothing was returned, so this panel has no data — not zero."
2. **Every AI-generated sentence is visibly marked as generated**, with a small subtle badge and the model name on hover. Generated text must never look like a fact the operator verified.
3. **Every claim carries evidence.** Facts show a small superscript citation chip; clicking it opens a popover with the source URL, what was observed, and a certainty level of `observed` / `inferred` / `reported`. Inferred claims are visually weaker than observed ones.
4. **Filtered-empty is different from nothing-yet.** An empty table after filtering shows "No companies match these filters" with a **Clear filters** button. An empty table with no filters shows an onboarding empty state.

## Visual direction

Serious, dense, confident — closer to Linear, Vercel Dashboard and Stripe than to a marketing site. Data-dense but never cramped. Generous vertical rhythm, restrained colour, one accent. No gradients on large surfaces, no glassmorphism, no decorative illustrations, no stock photos, no emoji in the UI.

**Both light and dark themes are first-class.** Dark is the default. The theme toggle must not flash on load.

### Colour (OKLCH, use these exactly)

Light theme:
```
--background: oklch(0.975 0.006 255)   --foreground: oklch(0.22 0.03 258)
--card:       oklch(0.995 0.002 255)   --border:     oklch(0.86 0.012 255)
--primary:    oklch(0.5 0.17 258)      --primary-foreground: oklch(0.99 0.005 255)
--muted:      oklch(0.945 0.008 255)   --muted-foreground:   oklch(0.47 0.03 258)
--accent:     oklch(0.93 0.03 258)     --accent-foreground:  oklch(0.3 0.08 258)
--success: oklch(0.48 0.13 150)  --success-subtle: oklch(0.95 0.04 150)
--warning: oklch(0.5 0.12 78)    --warning-subtle: oklch(0.95 0.05 78)
--danger:  oklch(0.52 0.2 27)    --danger-subtle:  oklch(0.95 0.03 27)
--info:    oklch(0.5 0.12 220)   --info-subtle:    oklch(0.95 0.03 220)
```

Dark theme:
```
--background: oklch(0.19 0.015 258)  --foreground: oklch(0.96 0.005 255)
--card:       oklch(0.235 0.018 258) --primary:    oklch(0.7 0.15 258)
--muted:      oklch(0.28 0.018 258)  --muted-foreground: oklch(0.74 0.02 258)
--accent:     oklch(0.33 0.04 258)
--success: oklch(0.75 0.14 150)  --warning: oklch(0.79 0.13 78)
--danger:  oklch(0.7 0.17 27)    --info:    oklch(0.74 0.12 220)
```

Charts: `oklch(0.5 0.17 258)`, `oklch(0.62 0.15 150)`, `oklch(0.54 0.14 60)`, `oklch(0.44 0.16 330)`, `oklch(0.6 0.12 205)`.

Every surface has a slight blue cast — nothing is pure grey. Radius base `0.625rem`. Use soft, low-spread shadows for elevation, not heavy drop shadows.

### Typography

- Headings: **Space Grotesk**, tight tracking
- Body / UI: **Geist Sans** (or Inter)
- Numbers, IDs, URLs, code, tech names: **Geist Mono** (or JetBrains Mono), tabular figures so columns of numbers align

### Motion

Purposeful only. 150–250ms, `cubic-bezier(0.22, 1, 0.36, 1)`. Content rises in slightly on mount. Skeletons on every async panel — never a spinner over a whole page. Respect `prefers-reduced-motion`.

## Screens to build

### 1. App shell
Persistent left sidebar (collapsible to icons), with a mobile drawer under `md`. Navigation: **Dashboard, Pipeline, Leads, Companies, Outreach Review, Analytics, Operations, API Status**. Sidebar footer: theme toggle, account menu, and the current role badge (`Operator` or `Viewer`). Top bar with breadcrumbs, a global search command palette (`⌘K`), and a notification bell.

### 2. Sign in
Split layout. Left: form (email, password) with inline field errors. Right: a quiet, abstract panel stating the product principle — *"Finds leads. Drafts outreach. Never sends without you."* No social login.

### 3. Dashboard
Hero row of four stat cards: companies discovered, leads scored, drafts awaiting review, model spend this month. Each card shows the number, a delta vs last period, and a sparkline. Below: a "Pipeline health" horizontal funnel showing how many companies sit at each of the nine stages, an activity feed of recent events, and a "Needs your attention" list (drafts waiting, failed analyses, stale leads).

### 4. Pipeline — the most important screen
- **Start a run** card at the top, **visible only to Operator**: country, city, industry, candidate limit (slider, default 25), spend ceiling in USD. Primary button: **Start pipeline run**. A quiet inline note beside it: *"Runs stop at a drafted message. Nothing is ever sent."*
- **Run list** below: each row shows state (`Running`, `Completed`, `Stopped at ceiling`, `Failed`), the parameters, started time, duration, companies processed, and spend.
- **Run detail page**: a vertical nine-stage progress rail. Each stage shows completed / in-flight / failed counts and a progress bar, and a stage that has not started yet is visually distinct from one that ran and found nothing. Live-polling feel — counts tick up while running, with a subtle pulse on the active stage. A per-source panel showing which discovery sources ran and which were skipped, each skipped one naming exactly what was missing. A failures list with the reason per company. A spend meter showing spend against the declared ceiling, turning amber near it.
- When a run finishes: a clear terminal banner stating **which** of completed / stopped-at-ceiling / failed it was, and why.

### 5. Leads
Dense sortable table: company, score (0–100 with a coloured band), stage, industry, city, last activity. Sticky header, row hover, keyboard row navigation, and a filter bar (score range, industry, city, stage, staleness) whose active filters appear as removable chips. Bulk selection with a floating action bar.

### 6. Lead detail
Two-column. Left: score breakdown as a set of weighted factor bars, each factor expandable to show the evidence behind it. The opportunity summary (marked as generated). Contact details with certainty labels. Right rail: company snapshot, quick actions, and a timeline of every stage that ran with its timestamp and outcome.

### 7. Companies + Company detail
List view mirroring Leads, plus a **Needs attention** sub-view for companies whose verification or analysis failed. Detail page has tabbed panels: **Overview, Website analysis** (performance scores as radial gauges, page-by-page findings), **Technology** (detected stack as chips, each showing `observed` vs `inferred`, with inferred ones showing what implied them), **Contacts**, **Opportunities**, **History**. Every panel independently handles its own four data states.

### 8. Outreach review — the human gate
Queue list on the left, draft detail on the right. The detail shows the drafted message in a realistic email frame, side by side with the evidence that justified each personalised sentence — hovering a sentence highlights the fact it came from. Actions: **Approve**, **Request changes**, **Reject**, plus an editable draft body. Approving must require a deliberate confirm step, and the UI should state plainly that approval does not send — it marks the message ready.

### 9. Analytics
Charts over time: discovery volume, score distribution histogram, stage conversion funnel, model spend by day and by stage, reply rate. Range selector. Every chart has a legend, accessible labels, and its own empty and unavailable states.

### 10. Operations
System health cards (API, database, queue, browser worker), queue depth per stage, recent job failures with retry buttons, rate-limit status per source, and a spend ceiling panel.

### 11. API status
A public-feeling status page: each dependency with an uptime bar of the last 90 days, current latency, and incident notes.

## Components I want done properly

- **Toasts**: bottom-right, stacked, four tones (success / warning / danger / info), each with a title, one line of detail, an optional undo action, and a progress bar for auto-dismiss. Swipe to dismiss. Screen-reader announced.
- **Empty states**: an icon, a headline, one sentence of explanation, and exactly one clear action.
- **Skeletons** matching the real layout's shape, per panel.
- **Data tables**: sticky headers, column sort indicators, resizable columns, tabular numerals, zebra-free but with clear hover, and a density toggle.
- **Score badge**: one component, colour-banded, used identically everywhere.
- **Certainty chip**: `observed` (solid), `inferred` (outlined, dimmer), `reported` (dashed).
- **Generated badge**: small, subtle, always adjacent to AI-written text.
- **Confirm dialog** for anything irreversible, naming the exact consequence.

## Accessibility and responsiveness

WCAG AA contrast in both themes. Full keyboard navigation with visible focus rings. Semantic landmarks and table markup. Never rely on colour alone — always pair a colour with a label or icon. Every layout works from 375px to 2560px; tables become card lists on mobile.

## Do not build

No landing/marketing page. No pricing, no onboarding tour, no chat widget. No "send now" button anywhere in the product. No fake progress bars that are not tied to state.
