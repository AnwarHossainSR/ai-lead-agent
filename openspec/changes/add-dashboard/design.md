# Design — Add Dashboard

## Context

`apps/web` is a Next.js 16 App Router application with React 19, Tailwind, shadcn/ui and a Playwright smoke test. It renders a header, a sidebar and a placeholder area, and fetches `/health` server-side with a bounded timeout and a labelled degraded state. That degraded-state pattern is the one this change extends everywhere.

The API now exposes leads with scores and explanations, companies with verification and analysis outcomes, opportunities with citations, detections with matched text, contacts with sources, summaries marked generated, drafts awaiting approval, response outcomes and queue state.

Two things make this more than CRUD screens. First, the review queue is where the product's central promise is either kept or quietly abandoned — if approving is tedious, it gets batched, and batching is how "a human approved it" becomes "a human clicked something". Second, every record in this system knows whether it was observed or inferred and where it came from, and a UI that flattens that distinction discards the discipline the whole data model exists to enforce.

## Goals / Non-Goals

**Goals:**

- Make the highest-value action — reviewing a message against its evidence — genuinely fast.
- Render observed, inferred and unknown as three different things.
- Show failures as states, not gaps.
- Report numbers with their denominators.

**Non-Goals — refused:**

- Any send control. Any bulk approval.

**Deferred:** authentication; configuration editing; real-time updates; mobile-first layouts; export.

## Decisions

### D1 — Server components by default, client components only for interaction

Lists, detail views and analytics are React Server Components fetching from the API during render. Client components are used for the review queue's editor, filter controls and chart interaction.

**Why:** no client-side data-fetching library, no client cache to invalidate, no loading-state machinery for the majority of the surface. The API is on localhost; a server render is fast.

Mutations are Server Actions calling the API. `revalidatePath` after a mutation is the whole cache story.

### D2 — Three primitives carry the evidence discipline

Rather than each view deciding how to render a fact, three components do:

- **`<Fact>`** — a value plus its certainty and source. Renders observed plainly; renders inferred with a distinct treatment and a tooltip naming what it was inferred from; renders unknown as the word *unknown* in a muted style. It has no code path that produces an empty string, a dash, or a zero for a missing value.
- **`<Evidence>`** — a source URL, the time recorded, and the matched or cited text, in a popover so the page is not a wall of citations.
- **`<Generated>`** — wraps model-produced prose with a persistent label.

**Every fact in the application goes through these.** That is what makes "observed and inferred are visually distinct" testable — a Playwright test asserts the markers exist on a known-inferred value, and a lint rule can flag raw rendering of a value that carries a certainty.

**Unknown as a word, not a dash:** a dash reads as "nothing here"; the platform's position is "we looked and do not know", which is a different and more useful statement.

### D3 — The review queue is one message at a time, and the layout is the argument

```
┌─────────────────────────────┬───────────────────────────┐
│ Message                     │ Facts it cites            │
│  subject, body, editable    │  each with source link    │
│                             │  and observed/inferred    │
│                             │                           │
│ [Approve] [Reject…] [Cancel]│ Contact: sourced at …     │
└─────────────────────────────┴───────────────────────────┘
        n of m awaiting review        [Next →]
```

The message and the facts it rests on are side by side, because the question a reviewer is answering is "is this true", not "does this read well".

**Approve is disabled until the message body has been rendered in the viewport.** That sounds fussy and is the mechanism by which "displayed before approved" is more than a hope.

**No approve-all, no multi-select, no keyboard shortcut that approves without scrolling.** A Playwright test asserts no such control exists.

`Reject` opens a required reason field — the API refuses a blank one, and the UI refuses before the round trip.

### D4 — Failure states get first-class treatment

Every list has a status column that renders the real outcome: `verified`, `unverified`, `unreachable`, `blocked`, `skipped`, `failed`, `below threshold`, `never attempted`. Filters include them. A dedicated "needs attention" view collects everything blocked, failed or unreachable.

**Why this earns a design decision:** the natural implementation shows successful records and silently omits the rest, and a platform that quietly discards the companies it could not analyse is lying about its coverage. Every earlier change went to trouble to record *why* something failed; this is where that pays off.

### D5 — Charts render the denominator

Recharts, with a shared wrapper that takes `{ rate, sent, responded, unrecorded, belowMinimum }` and always renders the counts alongside the rate. A segment with `belowMinimum` renders with a distinct treatment and its trend line suppressed.

**No sparkline, no percentage delta, no "up from last month" below the reporting minimum.** The aggregate endpoint already refuses to compute those; the chart wrapper refuses to draw them.

### D6 — Route structure

```
app/
├─ (workspace)/
│  ├─ leads/[page.tsx, [id]/page.tsx]
│  ├─ companies/[page.tsx, [id]/page.tsx]
│  ├─ outreach/review/[page.tsx, [id]/page.tsx]
│  ├─ analytics/page.tsx
│  └─ operations/page.tsx        queues, failed jobs, discovery runs
└─ api-status/                    the existing health surface
```

Filters live in the URL as search params, so a filtered list is a link an operator can bookmark and a Playwright test can navigate to directly.

### D7 — Degradation per panel, not per page

Each panel is its own Suspense boundary with its own error boundary, fetching with the bounded-timeout helper the shell already uses. A failing panel renders its condition; the rest of the page renders.

**Why per panel:** the operations view fetches queue state, discovery runs and failed jobs. If Redis is down, the queue panel should say so and the discovery runs should still render.

### D8 — Testing

- **Playwright, against a seeded database:** the review workflow end to end — open, read, approve, then edit an approved message and assert it returns to the queue; a rejection requiring a reason; the absence of any bulk-approval or send control; keyboard operation of the review queue.
- **Evidence rendering tests:** a known-inferred value carries its marker, a known-unknown field renders the word, an unmeasured score does not render as zero.
- **Degradation tests:** API stopped — page renders with the condition; one endpoint erroring — only that panel degrades.
- **Accessibility:** automated checks against the lead list, lead detail and review queue, failing the run on a violation at the configured level.
- **Component tests** for `<Fact>`, `<Evidence>`, `<Generated>` and the chart wrapper's small-sample behaviour.

## Risks / Trade-offs

- **Server components make interactive filtering a round trip** → filters are URL state and the API is local; if it becomes slow, the fix is a client-side list on one route, not an architecture change.
- **The approve-after-render rule can be defeated by a determined operator** → true; it raises the floor rather than sealing it, and the recorded approval is per message with its own timestamp regardless.
- **Distinct treatment for inferred values adds visual noise** → intended; it is the product's core distinction and a UI that hides it is worse than an ugly one.
- **A "needs attention" view could become a graveyard** → it carries counts and ages, and the maintenance schedules in `add-background-jobs` retry the retryable states.
- **No authentication while a UI now exposes everything** → documented explicitly as local-only, and `add-authentication` is a separate change that can be applied independently of the pipeline.
- **Playwright suite growth slows CI** → the review workflow and the evidence rules are the tests worth the time; broad UI coverage is not attempted.
