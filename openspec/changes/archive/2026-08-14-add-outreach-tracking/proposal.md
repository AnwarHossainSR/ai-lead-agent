# Add Outreach Tracking and Evaluation

**Roadmap coverage:** the `manual outreach`, `response tracking` and `evaluation` stages of the core pipeline — the last three.

## Why

Approved messages exist and nothing records what happened to them. Without that, the platform is write-only: it produces leads and never learns whether any of them were worth producing. Scoring weights were set by judgement precisely because there was no outcome data; this is the change that starts creating some.

It is also the change that closes the lifecycle. `leads` has fourteen configured statuses and a validated transition map, and `applyLeadStatusChange` enforces it — but nothing advances a lead past its initial status, because nothing knows a message was sent or a reply arrived.

## What Changes

**Recording what a human did**

- An endpoint to record that an approved message was sent manually, with when it was sent and by what means. It records; it does not send, and the record can only be made for a message that was already approved.
- Endpoints to record a response — replied, bounced, unsubscribed, no response after a configured interval — with the response text where the operator chooses to paste it.
- A response classifier: given a pasted reply, categorise it as interested, not interested, wrong person, referral, unsubscribe request, or out of office. Classification is interpretation, so it is a model job — but the category drives a status transition, so a person confirms it before it takes effect.

**Lead lifecycle finally moves**

- Recording a send, a reply or a bounce proposes the corresponding lead status transition through the existing `canTransition` rules. An impermissible transition is refused naming the permitted targets, as it already is.

**Unsubscribe is absolute**

- A company or contact marked as not to be contacted is excluded from drafting, from outreach listings and from future runs. There is no override.

**Evaluation**

- Aggregates over what actually happened: response rate by industry, by service, by opportunity category, by priority band, by score decile — computed from recorded outcomes only, with counts always shown so a rate over four messages is visibly a rate over four messages.

## Capabilities

### New Capabilities

- `outreach-tracking`: Recording what a person actually did with an approved message and what came back, classifying replies with human confirmation, advancing the lead lifecycle through the existing transition rules, honouring an unsubscribe absolutely, and aggregating real outcomes without presenting a small sample as a trend.

### Modified Capabilities

- `lead-data-model`: adds response records, do-not-contact state on companies and contacts, and outcome aggregation support.
- `product-configuration`: adds response categories, their proposed status transitions, and the no-response interval.

## Impact

- New Nest module `apps/api/src/outreach-tracking/`.
- New classification prompt in `packages/ai`.
- One new migration in `packages/database`.
- Depends on `add-outreach-drafting`.

## Non-goals

Refused in this change:

- **Sending.** Still no transport, still no credential. This change records a human action after the fact.
- **Reading a mailbox to detect replies automatically.** That is `add-email-integration` territory and requires its own decision about mailbox access; it is not smuggled in here.
- **Any override of an unsubscribe.** There is no flag, no parameter and no admin path.

Deferred:

- **Automatic status transitions without confirmation** — a classified reply proposes; a person confirms.
- **Follow-up sequences** — still a schedule, still out of scope.
- **The analytics UI** — `add-dashboard`. This change provides the aggregates.
- **Rescoring based on outcomes** — there will not be enough data for a long time, and a learned weight from thirty messages is noise.
