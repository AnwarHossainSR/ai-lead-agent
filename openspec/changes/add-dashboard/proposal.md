# Add Dashboard

**Roadmap coverage:** the `evaluation` stage of the pipeline, and the operator-facing surface for every stage before it.

## Why

`apps/web` renders a shell with a header, a sidebar and a placeholder dashboard area that fetches the API health endpoint. Everything the platform has learned — companies, analyses, technology detections, opportunities, contacts, scored leads, research summaries, drafts awaiting approval, response outcomes — is reachable only through HTTP calls made by hand.

The single most consequential screen is the outreach review queue. Human approval before sending is the product's central promise, and until now "a person approves" has meant "a person constructs a POST request". A promise that inconvenient gets bypassed. Making review a good screen is what makes the guarantee survive contact with a working day.

The dashboard is also where the evidence discipline becomes visible or is lost. Every claim the platform holds knows whether it was observed or inferred, what its source URL is, and when it was recorded. A UI that renders inferred and observed identically throws away the distinction the entire data model was built to preserve.

## What Changes

**Lead workspace**

- A list of leads ordered by score with filters for priority, status, industry, city, service and staleness, and a detail view showing the score with its component breakdown and explanation, the opportunities with their cited evidence, the technology detections with their matched text, the contacts with their sources, and the research summary marked as generated.

**Outreach review queue**

- Drafts awaiting approval, one at a time, showing the message alongside the facts it cites, with approve, edit, reject-with-reason and cancel. Editing an approved message shows that the approval was revoked. There is no approve-all, because there is no bulk approval.

**Company and pipeline views**

- Companies with their verification state, analysis outcome and stage, including the ones that failed — `unreachable`, `blocked` and `below threshold` are visible states, not gaps.

**Analytics**

- Recharts views over the outcome aggregates: response rate by industry, service, opportunity category, priority band and score decile, always with counts, and small samples visibly marked as such.

**Operations**

- Queue depths, failed jobs with reasons and an explicit retry; discovery runs with their per-source counts.

**Evidence rendering rules**

- Observed and inferred are visually distinct everywhere. Every claim links to its source URL. Unknown renders as unknown, never as a blank or a zero. Generated content is labelled wherever it appears.

## Capabilities

### New Capabilities

- `dashboard`: The operator's interface to everything the platform holds — leads ranked by score with their full evidence, the outreach review queue where approval actually happens, honest analytics with their counts, and pipeline operations — rendering observed, inferred and unknown as visibly different things.

### Modified Capabilities

- `developer-environment`: extends the web application shell requirement from a placeholder to the real application, and adds the accessibility and rendering guarantees the shell did not have.

## Impact

- Substantial expansion of `apps/web`: routes, server components, shadcn/ui components and Recharts views.
- New read endpoints in `apps/api` where the existing ones are insufficient for a list view.
- Playwright coverage of the review workflow and the evidence rendering rules.
- Depends on every preceding change.

## Non-goals

Refused:

- **A send button.** Nothing in the web application transmits an outreach message, and no endpoint exists for it to call.
- **Bulk approval, approve-all, or a keyboard shortcut that approves without showing the message.**

Deferred:

- **Authentication** — `add-authentication`. Until then the application is localhost-only and the documentation says so plainly.
- **Editing configuration through the UI** — countries, industries, services, weights and statuses are code, reviewed in pull requests.
- **Real-time updates.** Polling on the operations view is sufficient; sockets are a later decision.
- **Mobile layouts.** A single operator at a desk; the layout is responsive but not designed for a phone.
- **Exporting to CSV or a CRM** — `add-crm-integration` if it is ever proposed.
