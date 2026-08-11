# Design — Add Outreach Tracking and Evaluation

## Context

`outreach` already has `markOutreachSent` reachable only from `approved`, `recordOutreachResponse` reachable only from `sent`, and `CHECK` constraints refusing a sent record without an approval and a send time before its approval. `applyLeadStatusChange` reads the current status, calls `assertTransition`, and applies a conditional update — the transition map is validated at configuration load with terminal statuses having no targets.

So the lifecycle machinery is built and untravelled. This change supplies the events that move it, and one new safety property: an unsubscribe that cannot be overridden.

The temptation to resist is automation. Every step here has an obvious automated version — read the mailbox, classify the reply, advance the status, send the follow-up — and each one moves an irreversible external action further from a human. This change records and proposes; it does not act.

## Goals / Non-Goals

**Goals:**

- Know what happened to every message.
- Move the lead lifecycle for the first time, through the existing rules.
- Make an unsubscribe permanent and unoverridable.
- Produce outcome data honest enough to eventually recalibrate scoring.

**Non-Goals — refused:**

- Sending, or reading a mailbox to detect replies.
- Any override of a do-not-contact marker.
- Automatic status transitions without human confirmation.

**Deferred:** the analytics UI; outcome-driven rescoring.

## Decisions

### D1 — Recording a send is a statement by a person, and is treated as one

`POST /api/outreach/:id/sent { sentAt, means, note? }`. The operator states when and how. The record moves `approved → sent`.

`sentAt` is caller-supplied here, unlike `approvedAt`. That looks like a contradiction of the "timestamps come from the database clock" rule and is not: approval happens *in* the system, so the system knows when. A manual send happens outside it, and forcing `now()` would record a lie whenever someone logs a message they sent yesterday.

The guard is the existing `CHECK`: `sent_at >= approved_at`. A backdated send that predates its own approval is refused by the database.

### D2 — Classification proposes; a person confirms

```
POST /api/outreach/:id/responses/classify { text }
  -> { category, basis, proposedTransition: { from, to } }   // nothing written
POST /api/outreach/:id/responses { kind, receivedAt, text?, categoryId }
  -> records the response and applies the transition
```

Two calls. The first writes nothing to the lead. The second requires a `categoryId` the person either accepted or replaced from the configured set.

**Why not auto-apply a confident classification:** "not interested" and "wrong person, try my colleague" produce very different next actions and are easy to confuse. The cost of a wrong automatic transition is a lead silently marked dead. The cost of a confirmation click is a click.

**`basis` is the reply text the classifier relied on**, checked to occur in the supplied text — the same grounding pattern as everywhere else. A classification quoting text that is not in the reply is discarded.

**Unclassifiable is a real outcome.** The output schema is a discriminated union with an `unclassified` branch, so the model is not forced to pick the nearest category.

### D3 — Configured categories cannot propose impossible transitions

Each response category declares the transition it proposes, and configuration load validates that transition against the existing lead transition map. A category proposing `replied → new` fails at load rather than at the moment an operator clicks confirm.

This is the same shape as the priority bands being validated to cover 0–100 at load: the invalid configuration never reaches runtime.

### D4 — Do-not-contact: two rows, one rule, no override

```sql
-- companies and contacts each gain:
do_not_contact_at timestamptz,
do_not_contact_reason text,
check (do_not_contact_at is null or length(btrim(do_not_contact_reason)) > 0)
```

Enforcement is at three layers:

1. **Drafting** refuses, before any model call.
2. **The outreach write helper** refuses.
3. **The database** refuses, via a trigger on `outreach` insert checking both the contact and its company. This is the one place a trigger is warranted rather than a `CHECK`, because the condition lives on another table.

**There is no override.** No `force` parameter, no admin route, no configuration flag. A test asserts the outreach interfaces expose no such parameter. An operator who believes a marker is wrong clears it deliberately through its own endpoint, which is a separate, recorded act — not a flag on a send.

### D5 — Aggregates that refuse to overstate

Every aggregate returns `{ rate, sent, responded, unrecorded, belowMinimum }`. `belowMinimum` is true when `sent < REPORTING_MINIMUM_SAMPLE`, and the API returns the rate anyway — flagged — rather than hiding it, because an operator with nine data points should see nine data points, not an empty panel.

`unrecorded` is reported separately and excluded from both numerator and denominator. A response rate that silently counts unrecorded messages as failures is the most common way this kind of dashboard lies.

**No trend, no comparison, no "up 12% this month" below the minimum.** Segments are `industry`, `service`, `opportunity category`, `priority band`, `score decile`, computed as plain SQL aggregates over recorded outcomes.

### D6 — Schema

```sql
outreach_responses(
  id uuid pk,
  outreach_id uuid not null references outreach on delete cascade,
  kind outreach_response_kind not null,   -- replied|bounced|unsubscribed|no_response
  received_at timestamptz not null,
  body text,
  proposed_category_id text,
  confirmed_category_id text not null,
  ai_invocation_id uuid references ai_invocations on delete restrict,
  created_at timestamptz not null default now()
);
create index on outreach_responses (outreach_id, received_at desc);

-- outreach gains:
sent_means text,
check (sent_at is null or sent_means is not null)
```

The `received_at >= sent_at` rule is a trigger rather than a `CHECK`, since `sent_at` lives on the parent row.

### D7 — Testing

- **Unit, fake provider:** classification grounding rejecting a quoted basis absent from the reply; the `unclassified` branch; category resolution refusing an unknown identifier.
- **Integration, real PostgreSQL:** send before approval refused; response before send refused; the do-not-contact trigger refusing an outreach insert for a marked contact and for a marked company; the blank-reason `CHECK`.
- **Workflow test:** approve → record send → classify → confirm → assert the lead status moved through a permitted transition; and a separate case asserting an impermissible proposal is refused naming the permitted targets.
- **The absence test** asserting no override parameter exists on any drafting or outreach interface, and that recording a send contacts nothing.
- **Aggregate tests** with a nine-message segment asserting `belowMinimum` is true and the counts are returned.

## Risks / Trade-offs

- **Manual recording will be incomplete** → `unrecorded` is a first-class number in every aggregate rather than being folded into failure, so the incompleteness is visible instead of distorting the rates.
- **Caller-supplied `sentAt` can be wrong** → bounded by the existing `sent_at >= approved_at` constraint; beyond that it is the operator's own record of their own action.
- **A confirmation step will feel like friction at volume** → intended at this scale; if volume ever justifies revisiting it, that is a change with a proposal, not a default that crept in.
- **Small samples will be over-read anyway** → counts and the `belowMinimum` flag are always returned, and no trend is computed below the minimum; the platform can refuse to assert, not refuse to be misread.
- **Classification costs a model call per reply** → replies are low-volume by construction, and the `AIService` spend ceiling applies.
- **A trigger is heavier than a `CHECK`** → accepted for the one cross-table rule where the alternative is trusting the application layer with an unsubscribe.
