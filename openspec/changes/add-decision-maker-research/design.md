# Design — Add Decision Maker Research

## Context

`contacts` already carries `CHECK contacts_contact_details_need_a_source`: `(email IS NULL AND phone IS NULL) OR source_url IS NOT NULL`. That constraint was written for this change. Website analysis already fetches and stores the entry page and a configured set of extra paths, so most of the pages worth reading are already on disk. The shared `robots.txt` evaluator and per-host limiter exist. `packages/ai` provides schema-validated output with an audit trail.

This change is unusual in that its most important design decisions are about code that will not exist. Email pattern guessing is the default technique in this product category, it is trivially easy to add, and every guessed address that happens to deliver looks like a success. So the design records not just the absence but the mechanism keeping it absent.

## Goals / Non-Goals

**Goals:**

- Find real, published, business contact information.
- Make every claim checkable at a URL.
- Keep interpretation visibly separate from extraction.
- Make address construction impossible to add by accident.

**Non-Goals — the first two refused rather than deferred:**

- Constructing, permuting or guessing an address. Ever.
- Probing a mailbox over SMTP.
- LinkedIn or any source whose terms prohibit collection.
- Paid contact-data providers.
- Storing information about people not presented as business contacts.

## Decisions

### D1 — Two extractors with different trust levels

**Deterministic extraction** — `mailto:` and `tel:` hrefs, `schema.org` `Person` / `Organization` structured data, `<meta>` author fields, and visible addresses matched by a strict pattern against the page's rendered text. These are things the company *published in a machine-readable position*. They produce `certainty = observed` and `extraction_method = 'extracted'`.

**Model interpretation** — a team or about page written as prose ("Fatima Al-Rashid leads our digital operations") states a person and a role that no parser recovers reliably. That is interpretation, which is what the model is for. Produces `certainty = inferred`, `extraction_method = 'interpreted'`, with the invocation referenced.

Keeping these separate in the data — not just in the code — is what lets a later change decide to only ever email an observed address.

### D2 — The people-extraction prompt has no field for a contact detail

```ts
const person = z.object({
  name: z.string().trim().min(1),
  role: z.string().trim().min(1).nullish(),
  namingText: z.string().trim().min(1),   // the sentence that names them
});
const output = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("people"), people: z.array(person).min(1) }),
  z.object({ outcome: z.literal("no_people_found") }),
]);
```

No `email`, no `phone`, no `contact`. The model is never in a position to supply one, so it can never invent one. A test asserts the key set.

**`namingText` is the grounding check**, the same mechanism as opportunity analysis: after parsing, each person's `namingText` must actually occur in the supplied page text (normalized for whitespace). A person the model produced from nowhere is discarded and counted. Names are short and easy to hallucinate; a required verbatim quote is not.

### D3 — There is no address construction path, and a test says so

Concretely:

- No configuration field for a pattern, template or permutation set — asserted by a schema key-set test.
- No function taking a name and a domain and returning an address — asserted by a source-level test scanning the module for the shapes such a helper takes.
- The write helper accepts an email only together with the `source_url` it was seen at, and the database `CHECK` enforces the same thing for anything bypassing the helper.

The test is crude. It is there because the alternative is a comment nobody reads, and because the person most likely to add this is a future contributor who has seen every other tool in this category do it.

### D4 — Deliverability: MX lookup only, tri-state result

`receivable` | `not_receivable` | `unknown`, derived from a DNS MX lookup of the address's domain, cached per domain for a configured TTL.

**Why not SMTP probing:** opening a session and issuing `RCPT TO` to learn whether a mailbox exists is intrusive, gets the source IP blacklisted, is unreliable against catch-all servers, and is widely treated as abuse. It also has no legitimate purpose here — the address was published, so its existence is not in question.

**A lookup failure yields `unknown`, never `not_receivable`.** Collapsing "we could not check" into "this address is bad" is the same error as collapsing verification's `unreachable` into `unverified`, and it discards real contacts because a resolver had a bad moment.

Deliverability is recorded and *never* used to filter an address out of storage. A published address at a domain with no MX record is still a fact about the company.

### D5 — Seniority is pattern matching against configured levels

Levels are configured with ranks (`owner` 100, `c_level` 90, `director` 70, `head` 60, `manager` 40, `other` 10) and role patterns map titles to them. Arabic and English title variants both live in configuration, which is the point of configuration.

No match yields `unknown`, and a contact with no title cannot carry a seniority at all — enforced by a `CHECK`. A model is not asked to rank people: ranking feeds scoring, and scoring is deterministic.

### D6 — Which pages get fetched

1. Pages website analysis already captured — free, already polite, already stored.
2. Configured conventional paths (`/team`, `/about`, `/about-us`, `/leadership`, `/contact`, `/contact-us`, `/our-team`) not already captured — each a separate request through the shared limiter and `robots.txt` evaluator.

Nothing else. No link following, no search, no sitemap walk. A 404 on a conventional path is normal and recorded as such.

### D7 — Schema changes

```sql
-- contacts gains:
extraction_method contact_extraction_method not null,   -- extracted | interpreted | manual
seniority_id text,
role_source_url text,
mail_deliverability mail_deliverability not null default 'unknown',  -- receivable|not_receivable|unknown
ai_invocation_id uuid references ai_invocations on delete restrict,

check (extraction_method <> 'interpreted' or ai_invocation_id is not null),
check (seniority_id is null or job_title is not null)

contact_research_runs(
  id uuid pk,
  company_id uuid not null references companies on delete cascade,
  outcome contact_research_outcome not null,   -- contacts_found|none_found|blocked|skipped|failed
  pages_fetched jsonb not null default '[]',
  pages_skipped jsonb not null default '[]',   -- [{path, reason}]
  found_count integer not null default 0,
  rejected_count integer not null default 0,
  rejections jsonb not null default '[]',
  ai_invocation_id uuid references ai_invocations on delete restrict,
  created_at timestamptz not null default now()
);
```

`extraction_method` is `NOT NULL` with no default. A default would let an existing insert path silently claim `extracted` for something interpreted, and the whole value of the column is that it is never wrong.

### D8 — Personal data handling

Everything stored is business contact information a company published about its own staff, which is the narrowest defensible scope. Two concrete consequences:

- **Deletion is supported at the company level and the contact level**, cascading from `companies` as it already does, plus an explicit contact-deletion path — so a request to remove a person is one call, not a manual query.
- **`namingText` and page text are not persisted** beyond what is needed for the source URL and the stored fields. The captured page already lives in the analysis artifacts; contacts do not keep a second copy.

### D9 — Testing

- **Unit, no network:** each deterministic extractor against HTML fixtures; the `namingText` grounding check; seniority classification including no-match and no-title; the MX tri-state including lookup failure yielding `unknown`.
- **The absence tests:** configuration schema key set contains no pattern field; a source scan finds no name-plus-domain-to-address helper; the output schema has no contact field.
- **Integration, real PostgreSQL:** the existing source-URL `CHECK` still refuses a sourceless detail; the two new `CHECK`s via raw `INSERT`; cascade deletion.
- **Fixture pages** cover a `mailto:` page, a structured-data page, a prose team page, a page with an address at a different domain, a blocked host, and a `robots.txt` disallowing `/team`.
- **No test contacts a real host or a real provider.**

## Risks / Trade-offs

- **Far fewer contacts than a tool that guesses** → accepted; it is the constraint the product is built on. The operator can add a contact manually with `extraction_method = 'manual'` and their own source.
- **A future contributor adds pattern guessing "just as a fallback"** → the absence tests and the database `CHECK` both fail, and this document says why. That is the strongest available guard short of not writing the module.
- **Model interpretation attaches the wrong role to the right person** → recorded as `inferred` with the invocation and the source URL, so it is inspectable; and outreach requires human approval before anything is sent.
- **Stale contacts** — people leave → runs are timestamped and re-runnable, and the dashboard change surfaces contact age. No automatic re-check until the queue change.
- **Prose pages in Arabic** → the model handles them; the deterministic extractors are language-independent since they work on markup, not words. Seniority patterns for Arabic titles are configuration, and their absence yields `unknown` rather than a wrong level.
- **A company publishes a shared inbox rather than a person** → stored as a contact with no name and no seniority, which is honest; scoring can weight it accordingly.
