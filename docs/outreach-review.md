# Outreach Review Workflow

## Overview

Outreach in MELA is a human-in-the-loop process. The AI drafts a personalised message grounded in stored lead evidence, but no message is sent automatically. A person reviews, edits, and explicitly approves each draft before it can be marked as sent.

## States

| State | Meaning |
|-------|---------|
| `draft` | The message is being composed or edited |
| `pending_approval` | Submitted for human review |
| `approved` | A human approved the exact text |
| `rejected` | A human rejected it with a reason |
| `sent` | Marked as transmitted (manual action outside this system) |
| `replied` | The lead responded |
| `bounced` | The transmission failed |
| `cancelled` | Withdrawn before sending |

## Workflow

```
draft → pending_approval → approved → sent → replied/bounced
                ↓               ↓
             rejected       cancelled
                            ↓
                          draft (edit revokes approval)
```

### Drafting

`POST /api/leads/:id/outreach/draft` creates a draft. The request supplies:

- `leadId` — the lead to contact
- `contactId` — the specific contact to address
- `channelId` — the outreach channel (`email`, `linkedin`, `whatsapp`)

The service assembles the lead's current research summary, opportunities, contact details and the configured service catalogue into a prompt. The model returns a subject (where the channel uses one), a body, and the list of claims with citations.

### Grounding

Before a draft is stored, the output is screened:

- **Citations**: every claim must cite an identifier present in the input. Uncited claims reject the whole draft.
- **Prohibited content**: the body and claims are checked against configured categories (invented fact, promised outcome, false relationship, commercial terms, urgency pressure). Matches reject the draft.
- **Length**: the subject and body must respect the channel's maximum lengths. Oversize drafts are rejected, not truncated.

### Submission

`POST /api/outreach/:id/submit` moves a draft from `draft` to `pending_approval`. Only a draft can be submitted.

### Approval

`POST /api/outreach/:id/approve` records approval with a server-side timestamp. The draft must be in `draft` or `pending_approval`. On approval, the system computes the MD5 hash of the current subject and body and stores it as `approved_text_hash`.

### Rejection

`POST /api/outreach/:id/reject` requires a non-blank reason in the request body. Only a record in `pending_approval` can be rejected. Once rejected, it cannot be approved.

### Cancellation

`POST /api/outreach/:id/cancel` withdraws a record that has not been sent. It can be cancelled from `draft`, `pending_approval`, or `approved`.

### Editing

`PATCH /api/outreach/:id` updates the subject and/or body. If the record was `approved`, editing revokes approval: the status returns to `draft`, `approved_at` is cleared, and `approval_revoked_at` records when the edit happened. This ensures the text a person read is the text that goes out.

## Why There Is No Bulk Approval

Approval is per-message because each draft is grounded in specific evidence and addressed to a specific contact. A bulk action would bypass the review of whether the citations are correct, whether the tone is appropriate for the channel, and whether the contact details are accurate. The database constraint `outreach_approved_text_hash_matches` ensures that even if someone tries to mark multiple messages approved in a single transaction, each one must individually satisfy the approval rules.

## Why There Is No Send Endpoint

Sending requires a transport (SMTP, LinkedIn API, WhatsApp Business API, etc.) and corresponding credentials. Adding any of those would introduce a dependency on an external service, a secret in the environment, and a code path that can transmit data. The current design keeps the system honest: it records intent and approval, but the actual transmission is a manual step outside the system.
