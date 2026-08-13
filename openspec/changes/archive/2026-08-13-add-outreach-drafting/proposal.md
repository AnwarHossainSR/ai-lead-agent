# Add Outreach Drafting and Human Approval

**Roadmap coverage:** the `outreach draft` and `HUMAN review` stages of the core pipeline.

## Why

`outreach` exists with a seven-state status enum, four `CHECK` constraints preventing a sent record without an approval and preventing a sent timestamp earlier than its approval, and write helpers with no parameter that could create a record already approved. That machinery has never had a message pass through it.

Personalization is what the model is genuinely good at and what an operator has no time for: the same opportunity phrased for a Dubai e-commerce founder and a Riyadh logistics director are different messages, and writing forty of them by hand is the reason lead tools exist.

It is also the point of maximum consequence. Everything before this is internal — a wrong score costs a wasted hour. A message is external, goes to a real person, and cannot be recalled. So this change adds drafting and the review workflow, and adds **nothing that could send**.

## What Changes

**A drafting module in `apps/api`**

- A versioned prompt per channel taking the lead's research summary, its opportunities with their citations, the chosen contact and the operator's service catalogue, and returning a subject and body for one message.
- Grounding enforced as elsewhere: every specific claim in the draft must cite a supplied fact, checked after parsing. A draft containing an unsupported claim about the recipient's business is rejected, not edited.
- Channel-aware constraints from configuration — length limits, whether a subject applies, tone — validated after generation.
- A **prohibited-content check** rejecting drafts that assert things the platform does not know, promise outcomes, or claim a prior relationship that does not exist.

**The review workflow, and only the review workflow**

- Endpoints to draft, list drafts awaiting review, edit a draft, approve, reject with a reason, and cancel.
- Approval is a deliberate act by a person, recorded with its own timestamp taken server-side.
- **Editing a draft after approval revokes the approval.** Approving text and sending different text is the failure this prevents.

**There is no send**

- No transport, no client, no scheduler, no provider credentials, no endpoint that could transmit anything. Recording that an approved message was sent manually is `add-outreach-tracking`.

## Capabilities

### New Capabilities

- `outreach-drafting`: Generating a personalized message for one lead on one channel from facts the platform already holds, requiring every specific claim to cite one of them, and routing every draft through an explicit human approval that a later edit revokes — with no mechanism anywhere in the change capable of sending.

### Modified Capabilities

- `lead-data-model`: adds draft provenance, edit history and rejection reasons to `outreach`, and the constraint that an edit after approval clears the approval.

## Impact

- New Nest module `apps/api/src/outreach/`.
- New prompts in `packages/ai`, one per configured channel.
- One new migration in `packages/database` altering `outreach`.
- No new dependency. Deliberately no email, LinkedIn or messaging client of any kind.
- Depends on `add-research-summary`.

## Non-goals

Refused in this change, not merely deferred:

- **Sending anything, by any channel, under any condition.** No transport is added. No credential for a sending service is added to the environment. No endpoint exists that could transmit.
- **Automatic approval, bulk approval, or an approve-all action.** Approval is per message.
- **Scheduling a send for later.** A scheduler is a send with a delay.
- **Drafting for a contact with no source URL for its address.** If the address was not published with a source, there is nobody to write to.

Deferred to later changes:

- **Recording a manual send and tracking the response** — `add-outreach-tracking`.
- **A review UI** — `add-dashboard`. This change exposes the API.
- **Follow-up sequences** — a sequence is a schedule, and a schedule is closer to automatic sending than this project permits without a further explicit decision.
