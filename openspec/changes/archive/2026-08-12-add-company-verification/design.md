# Design — Add Company Verification

## Context

Discovery produces companies whose attributes were *claimed by a source*. `companies.verified` is a boolean defaulting to false that no code path currently writes. `packages/config` already validates domain configuration at module load and refuses unknown identifiers by name, which is the pattern the verification rule follows.

The interesting constraint is that verification produces a *decision*, and the product principles reserve decisions for deterministic code. So no part of this change may call a language model — not to judge name similarity, not to interpret a registry page, not to summarise a result.

The second constraint is that a check failing to reach its source is not the same as a check finding the company absent. Collapsing those two into "not verified" is how a platform ends up quietly discarding real companies because a DNS server had a bad afternoon.

## Goals / Non-Goals

**Goals:**

- Turn a claim into an observation, with evidence anyone can inspect.
- Keep "we could not tell" distinct from "it is not there".
- Make `verified` impossible to set by hand.
- Make a verdict re-derivable from its stored evidence.

**Non-Goals:**

- Judging site quality, technology or content.
- Any model call.
- Commercial enrichment providers.
- Scheduling re-verification.

## Decisions

### D1 — Three verdicts per check, four states per company

Check verdict: `passed` | `failed` | `unknown`.
Company state: `never_checked` | `verified` | `unverified` | `unreachable`.

`unreachable` is the state that matters. It means every required check either returned unknown or could not run — the company is neither confirmed nor refuted. Downstream it behaves like unverified (nothing expensive is spent on it) but it is retried on a shorter interval, and a human looking at the dashboard can see the difference between "we checked and it is gone" and "we could not check".

**Alternative rejected:** a single confidence number. It reads as precision the evidence does not support and cannot be re-derived into an explanation.

### D2 — Four checks, none of which need a browser

| Check | What it observes | Evidence | Source |
|---|---|---|---|
| `dns` | the claimed domain resolves | resolved record types and answers | the domain |
| `http` | the site answers with a success or redirect status | final URL after redirects, status, response time | the website |
| `domain-name-match` | the domain plausibly corresponds to the company name | the normalized name, the normalized domain label, and the comparison applied | derived, no request |
| `registry` | the company appears in a configured public registry for its country | the matched registry entry | the registry record URL |

`domain-name-match` is deliberately weak and deliberately never *required*: it can only ever contribute, because a real company can trade on a domain that looks nothing like its name. It is implemented as a deterministic token-overlap comparison over the already-normalized values — no fuzzy library, no model, no threshold pulled out of the air beyond one that is configuration and testable.

`registry` is configured per country and simply absent where no public registry with a usable interface exists. An absent check returns `unknown`, and the rule must not require a check that is unavailable for a country — validated at load.

**No browser and no Lighthouse here.** Verification asks whether the host answers. A company with a slow, ugly, JavaScript-only site is verified and is exactly the prospect this product exists to find.

### D3 — The rule is data, and it is evaluated in one pure function

```ts
// packages/config
verificationRule = {
  checks: {
    dns:               { required: true,  sufficient: false, timeoutMs: 5_000 },
    http:              { required: true,  sufficient: false, timeoutMs: 10_000 },
    "domain-name-match": { required: false, sufficient: false, timeoutMs: 0 },
    registry:          { required: false, sufficient: false, timeoutMs: 15_000 },
  },
  stalenessDays: 90,
}
```

```ts
function deriveState(results: readonly CheckResult[], rule: VerificationRule): VerificationState
```

Pure, total, and exported — which is what makes "the verdict can be recomputed from evidence" a testable scenario rather than a claim. Load-time validation rejects a rule naming an unimplemented check, a rule with no required check, and a non-positive timeout or window.

**Why `sufficient` exists at all** even though nothing uses it yet: a registry match on its own genuinely is sufficient for a company with no website, and encoding the concept now costs one field. It is validated and tested; it is not speculative machinery, it is one boolean.

### D4 — `verified` becomes derived, which is a breaking change to the write helpers

`insertCompany` loses its `verified` parameter entirely and `updateCompany` refuses it — the same shape used for outreach approval, where the absence of a parameter is the enforcement. A new `applyVerificationResult` helper is the only writer of `verification_state`, `verified_at` and `verified`.

`companies.verified` is kept as a generated summary of `verification_state = 'verified'` so existing reads and indexes keep working, rather than being deleted and every consumer edited.

### D5 — Schema

```sql
verification_checks(
  id uuid pk,
  company_id uuid not null references companies on delete cascade,
  run_id uuid not null,                      -- groups the checks of one verification pass
  check_id text not null,
  verdict verification_verdict not null,     -- passed | failed | unknown
  evidence jsonb,                            -- {detail, observedAt}
  evidence_url text,
  failure_code text,                          -- timeout | blocked | unusable_response | ...
  ran_at timestamptz not null default now(),
  check (verdict = 'unknown' or (evidence is not null and evidence_url is not null))
)
create index on verification_checks (company_id, ran_at desc);

-- companies gains:
verification_state company_verification_state not null default 'never_checked',
verified_at timestamptz,
verification_run_id uuid,
check (verification_state = 'never_checked' or verified_at is not null)
create index on companies (verified_at) where verification_state <> 'never_checked';
```

The `CHECK` on `verification_checks` is the "no verdict without evidence" rule enforced where a hand-written `INSERT` also meets it, exactly as the outreach approval constraints work.

### D6 — Politeness reuses discovery's mechanisms

The per-host rate limiter and `robots.txt` evaluator built in `add-company-discovery` are extracted to a shared `apps/api/src/http/` module and used by both. A verification pass makes at most `maxRequestsPerCompany` requests, and a host that blocks yields `unknown` with `failure_code = 'blocked'` — never a retry with different headers.

`dns` is exempt from `robots.txt` because DNS is not an HTTP resource; it is still rate-limited per resolver.

### D7 — Batches continue past failures

`verifyBatch` processes companies with a bounded concurrency (configured, default 4) and never lets one company's exception end the batch. The report separates `verified`, `unverified`, `unreachable` and `errored` — four counts, because collapsing `errored` into `unverified` would mean a bug in our own code silently marking real companies as absent.

### D8 — Testing

- **Unit, no network:** `deriveState` against every combination the rule admits, including all-unknown; `domain-name-match` comparisons; rule load-time validation; the evidence-required guard.
- **Integration, real PostgreSQL:** the `CHECK` constraint refusing an evidenced-free verdict via raw `INSERT`; history retained across two passes; the stale query using its index.
- **A local HTTP fixture server** provides slow, blocking, redirecting and erroring hosts. **No test contacts a real external host** — a suite that depends on the internet being well is not a test.
- **DNS is injected** so resolution failure is deterministic.

## Risks / Trade-offs

- **`unreachable` companies accumulate and nobody looks at them** → they are a distinct queryable state with a shorter retry interval, and the dashboard change surfaces them; a hidden bucket would be worse than a visible one.
- **A public registry changes its interface and the check silently degrades** → the check returns `unknown` with a `failure_code`, and a registry returning unknown for every company is visible in the batch report rather than looking like normal operation.
- **`domain-name-match` encourages a future contributor to make it required** → it is documented as never-required and the rule's load-time validation is the place to add a guard if that ever needs enforcing.
- **A verified company can stop existing the next day** → the staleness window exists precisely because verification is a snapshot; nothing here claims otherwise, and `verified_at` is stored so no consumer has to guess how old the claim is.
- **Removing `verified` from `insertCompany` breaks the seed script and existing tests** → intended, and the migration task includes updating them; a parameter nobody can pass is the point.
