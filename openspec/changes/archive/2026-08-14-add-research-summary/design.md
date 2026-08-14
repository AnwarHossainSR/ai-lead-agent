# Design — Add AI Research Summary

## Context

A scored lead already carries an assembled, deterministic explanation of its score. This change adds prose about the *company*, which is a different job: the explanation says why the number is what it is; the summary says what an operator is about to walk into.

Every mechanism this needs already exists — `AIService` with versioned prompts and validated output, the `ai_invocations` audit trail, and the citation-checking pattern established by `add-opportunity-analysis`. The new problem is narrower: a summary is *prose*, and prose is where a model most naturally adds the plausible sentence nobody asked for. "They appear to be scaling rapidly" is not in any input and is exactly the sort of thing that ends up in an email.

## Goals / Non-Goals

**Goals:**

- A briefing an operator can read in thirty seconds before a call.
- Every sentence traceable to a stored fact.
- The gaps stated, not glossed.
- Unmistakably labelled as generated.

**Non-Goals:**

- Retrieval, search, or any fetch.
- Statements about finances, headcount, hiring or plans.
- Adjusting the score.
- Writing the outreach message.

## Decisions

### D1 — The summary is structured, not a paragraph

```ts
const claim = z.object({
  text: z.string().trim().min(1),
  cites: z.array(z.string()).min(1),
});

const output = z.object({
  business: z.array(claim),        // what this company appears to do
  webPresence: z.array(claim),     // what was observed about the site
  opportunities: z.array(claim),   // what could be offered, and on what basis
  people: z.array(claim),          // who could be contacted
  approach: z.array(claim).max(3), // how to open, grounded in the above
});
```

**Why claims rather than paragraphs:** a citation attached to a paragraph is untestable — half the paragraph can be supported and half invented. A citation attached to a sentence is checkable, and rejecting one sentence leaves a shorter, still-honest summary rather than forcing all-or-nothing.

The reading experience is a list of short statements per section, which for a pre-call briefing is better than prose anyway.

`unknown` is deliberately **not** a model-produced field — see D3.

### D2 — Prohibited claims: a check the system runs, not an instruction the model follows

The prompt says not to make these claims. That is necessary and insufficient. After parsing, every claim's text is screened for the prohibited categories:

| Category | Screened for |
|---|---|
| finance | revenue, turnover, profit, valuation, funding, raised, ARR, budget |
| size | employees, headcount, staff of N, team of N |
| hiring | hiring, recruiting, expanding the team, open roles |
| trajectory | growing rapidly, scaling, expanding into, market leader |
| plans | plans to, intends to, is about to, roadmap |
| customers | serves N customers, client base of |

A matching claim is removed and counted. The screen is a curated list of patterns in configuration, tested with both positive and negative cases.

**This is a filter, not a proof.** It catches the phrasings a model actually produces; it cannot catch every possible one. It is worth having because the failure it prevents — an invented revenue figure in an outreach email — is severe and its false-positive cost is one dropped sentence.

**Deliberate exception:** a company size the platform *holds* from a cited source is not a fabrication. So the screen exempts a claim whose citation resolves to the stored `company_size` field. That is the one case where "team of 50" is a repeated fact rather than an invention.

### D3 — The unknown list is derived by the platform, not written by the model

Asking a model what it does not know is asking the wrong entity. The platform knows exactly which fields are absent: no company size, no description, no contact with an email, no completed analysis, no opportunities, a stale verification.

So `unknown` is computed from the lead's own record and attached to the summary after generation. The model never sees the question and cannot get it wrong.

This is the same instinct as the deterministic score explanation: where the system already holds the answer, generating it is strictly worse.

### D4 — Citation identifiers, and the all-rejected case

Same scheme as opportunity analysis: short call-local references (`f1`, `o3`, `c2`) minted per call, checked against the supplied set after parsing, resolved back to real identifiers before storage.

If **every** claim is rejected, no summary is stored. A summary consisting only of the derived unknown list would read as a briefing when it is a failure, and storing it would let the outreach change draft from nothing. The run records `failed` with the rejection counts.

### D5 — Schema

```sql
lead_research_summaries(
  id uuid pk,
  lead_id uuid not null references leads on delete cascade,
  company_id uuid not null references companies on delete cascade,
  sections jsonb not null,          -- {business:[{text,cites}], webPresence:[...], ...}
  cited_facts jsonb not null,       -- resolved real identifiers
  unknown_facts jsonb not null default '[]',
  rejections jsonb not null default '[]',
  prompt_version integer not null,
  ai_invocation_id uuid not null references ai_invocations on delete restrict,
  is_generated boolean not null default true,
  created_at timestamptz not null default now(),
  check (is_generated),
  check (jsonb_array_length(cited_facts) > 0)
);
create index on lead_research_summaries (lead_id, created_at desc, id desc);
```

`check (is_generated)` is a column that can only ever be true. That is intentional: it is the schema stating that nothing in this table is human-authored, so no future write can quietly present generated prose as researched fact. If a human-written note is ever wanted, it belongs in a different table with a different name.

The index carries `id desc` so the current-summary tie-break matches `getLatestWebsiteAnalysis`, which already resolves ties that way.

### D6 — Testing

- **Unit, fake provider:** the citation check including fabricated references; the all-rejected path storing nothing; each prohibited-claim category with positive and negative cases; the company-size exemption; the derived unknown list against fixtures with varying completeness.
- **A no-retrieval test** asserting the only outbound call during generation is the model call.
- **Integration, real PostgreSQL:** the `is_generated` and citation `CHECK`s via raw `INSERT`; regeneration retaining history; a failed regeneration leaving the previous summary current; the deterministic tie-break.
- **No test calls a real provider.**

## Risks / Trade-offs

- **The prohibited-claims screen is a pattern list and will miss phrasings** → stated plainly; it is one of several layers, the others being that citations must resolve, the summary is labelled generated, and a human approves every outreach message before it is sent.
- **A false positive drops a legitimate sentence** → cheap; the summary is shorter and still accurate, and rejections are counted so a screen that is too aggressive is visible.
- **Claim-list format reads as terse** → a deliberate trade for citability; for a thirty-second pre-call briefing it is arguably better than prose.
- **A model can cite a real fact and still draw a wrong conclusion** → citations make the reasoning inspectable rather than correct; this is the same limitation as opportunity analysis and is not claimed to be solved.
- **Cost on regeneration** → the `AIService` spend ceiling applies, and regeneration is explicit until the queue change.
