# Design — Add Outreach Drafting and Human Approval

## Context

The `outreach` table already enforces most of this change's safety properties in the database:

- `outreach_sent_requires_approval` — a sent record must have an approval timestamp.
- `outreach_sent_at_requires_approved_at` and `outreach_sent_at_not_before_approved_at` — a send cannot precede its approval.
- `outreach_responded_at_requires_sent_at`.
- `insertOutreachDraft` has no status, approval or sent parameter at all.
- `approveOutreach` takes its timestamp server-side so it cannot be backdated.
- Every configured outreach channel already declares automated sending as not permitted.

Those constraints were written and tested with raw `UPDATE`s that bypass the helpers. This change puts messages through them for the first time.

The one hole they do not close is the one this change must: **a record can be approved and then edited**, leaving an approved message whose text nobody approved. Everything else is already covered.

## Goals / Non-Goals

**Goals:**

- A message an operator would actually send, drafted from facts the platform holds.
- Approval that means the specific text a person read.
- No path from "generated" to "delivered" that does not pass through a human outside the system.

**Non-Goals — refused, not deferred:**

- Sending, scheduling a send, bulk approval, or approve-all.
- Any transport dependency or sending credential.
- Follow-up sequences.

**Deferred:** recording a manual send and its response; the review UI.

## Decisions

### D1 — The absence of a transport is a tested property, not a promise

`apps/api/package.json` gains no mail, messaging or social SDK. The API environment schema gains no SMTP host, no API key for a sending service, no webhook. A test asserts:

- the outreach module's dependency closure contains no known transport package,
- the environment schema has no key matching sending-credential patterns,
- no controller in the module returns a response indicating transmission.

Crude, and worth it. This is the product's central promise, and the way it gets broken is a well-meaning "just wire up the send button" three months from now. A failing test is a better guard than a paragraph.

### D2 — Editing an approved message revokes the approval

This is the one new safety rule. Two layers, as everywhere else:

**In the helper:** `updateOutreachText` clears `approved_at`, sets `status = 'draft'`, and records `approval_revoked_at` whenever it changes `subject` or `message_body` on a record whose status is `approved`.

**In the database:** an `approved_text_hash` column, set at approval to a hash of the text approved. A `CHECK` requires `status <> 'approved' OR approved_text_hash = <hash of current text>`. Since a `CHECK` cannot call a non-immutable function over other columns portably, this is implemented as a generated column holding the digest of `coalesce(subject,'') || '\n' || message_body`, compared against `approved_text_hash`.

So a hand-written `UPDATE outreach SET message_body = '...' WHERE status = 'approved'` fails at the database, exactly like the send-without-approval case already does.

### D3 — Grounding rejects the whole draft, unlike opportunity analysis

Opportunity analysis accepts the good opportunities and discards the bad ones. A message is different: it is one artefact read as a whole, and a draft with one invented sentence removed reads as a draft with a hole in it. Partial salvage would also create pressure to auto-repair, which means regenerating until something passes the check.

So: any unsupported claim rejects the draft in full, with the reason recorded. The operator regenerates or writes it themselves.

### D4 — What counts as a "specific claim"

Requiring a citation for *every sentence* would reject "I hope you're well". The prompt returns the body plus a list of claims it makes about the recipient's business, each with citations, and the check applies to those. A claim asserted in the body but absent from the claim list is caught by D5's screen rather than the citation check.

**This is the weakest joint in the design and is recorded as such.** The model self-reports which of its sentences are claims. The mitigations are that the prohibited-content screen runs over the whole body regardless, and that a human reads every message before it goes anywhere.

### D5 — Prohibited content, screened over the whole body

| Category | Rejects |
|---|---|
| invented fact | assertions about the business not resolvable to a cited fact |
| promised outcome | "will increase", "guaranteed", "you'll see N%" |
| false relationship | "as discussed", "following our call", "X suggested I reach out" |
| commercial terms | prices, rates, day counts, delivery timelines |
| urgency pressure | fabricated scarcity or deadlines |

Patterns live in configuration and are tested with positive and negative cases. A match rejects the draft.

`false relationship` matters most: it is the phrasing that most reliably gets a reply, which is exactly why a model produces it, and it is a lie about a real person.

### D6 — Channel constraints from configuration

Each configured channel declares max subject length, max body length, whether a subject applies, and its tone. Validated *after* generation — a 4000-character LinkedIn message is rejected rather than truncated, because truncation produces a message ending mid-sentence that somebody then approves.

The existing `automatedSendingPermitted: false` on every channel stays, and a test asserts no channel can be configured with it true.

### D7 — Schema changes to `outreach`

```sql
subject text,
generated_subject text,
generated_body text,
is_human_edited boolean not null default false,
prompt_version integer,
ai_invocation_id uuid references ai_invocations on delete restrict,
cited_facts jsonb not null default '[]',
rejection_reason text,
rejected_at timestamptz,
approval_revoked_at timestamptz,
approved_text_hash text,
current_text_hash text generated always as (md5(coalesce(subject,'') || E'\n' || message_body)) stored,

check (ai_invocation_id is not null or generated_body is null),
check (status <> 'approved' or approved_text_hash = current_text_hash),
check (rejected_at is null or length(btrim(rejection_reason)) > 0)
```

`generated_subject` / `generated_body` preserve what the model produced, so an edited message can always be compared against its origin. `md5` here is a change-detection digest, not a security control.

### D8 — The review workflow, and what it does not have

```
POST   /api/leads/:id/outreach/draft        generate
GET    /api/outreach?status=pending_approval list for review
PATCH  /api/outreach/:id                     edit subject/body (revokes approval)
POST   /api/outreach/:id/submit              draft -> pending_approval
POST   /api/outreach/:id/approve             one message, server timestamp
POST   /api/outreach/:id/reject              requires a reason
POST   /api/outreach/:id/cancel
```

No `POST /api/outreach/approve-all`, no `?ids=` array, no `POST /api/outreach/:id/send`. The approve endpoint takes a single id in the path, which is the shape that makes bulk approval require a new endpoint rather than a new parameter.

### D9 — Testing

- **Unit, fake provider:** the citation check rejecting whole drafts; every prohibited-content category with positive and negative cases; channel length validation rejecting rather than truncating; refusal for a contact with no sourced detail, an unknown channel, and a lead with no summary.
- **The absence tests** from D1.
- **Integration, real PostgreSQL:** the new `approved_text_hash` `CHECK` via a raw `UPDATE` changing the body of an approved record — the central test of this change; plus the existing send-requires-approval constraints re-asserted through the new path.
- **A workflow test:** draft → submit → approve → edit → assert back in draft with no approval and a recorded revocation.
- **No test calls a real provider, and no test sends anything.**

## Risks / Trade-offs

- **Self-reported claim lists are gameable** → recorded in D4 as the weakest joint; the body-wide screen and mandatory human review are the compensating layers, and this design does not claim more than that.
- **Whole-draft rejection is frustrating** → the reason is recorded and shown, and the operator can edit by hand; the alternative encourages regenerate-until-it-passes.
- **The hash `CHECK` adds a generated column to a hot table** → `outreach` is small and written rarely; the cost is negligible next to the guarantee.
- **An operator can still send a bad message** → true and unavoidable; the platform's job is to ensure the message they send is the message they read, and that nothing sends without them.
- **Pressure to add sending later** → it would be a change of its own, with its own proposal, and it would have to argue against the product's stated principle rather than slip in as a task.
