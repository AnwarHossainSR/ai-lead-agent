# Add Decision Maker Research

**Roadmap coverage:** the `decision maker research` stage of the core pipeline, between business opportunity analysis and lead scoring.

## Why

`contacts` exists with a `CHECK` constraint refusing an email or phone number without a source URL, and nothing writes to it. Without a person, a lead is a company nobody can talk to — every opportunity found so far has no recipient.

This is the change with the highest fabrication risk in the entire product, and the risk is not hypothetical. The standard technique in this industry is to guess: take a name, take a domain, try `first.last@domain`, `f.last@domain`, `first@domain`, and send to whichever does not bounce. That produces an address nobody published, attached to a person who never gave it, and it is exactly what "never fabricate contacts or email addresses" rules out. A guessed address that happens to work is still fabricated.

So this change is defined as much by what it refuses to do as by what it does. It records people the company itself published, on pages the platform actually fetched, with the URL where each claim can be checked.

## What Changes

**A contact research module in `apps/api`**

- Extraction from **pages the platform already captured**: the entry page and the configured extra paths from website analysis, plus a small set of conventional pages (`/team`, `/about`, `/leadership`, `/contact`) fetched under the same politeness rules.
- A deterministic extractor for what can be recognised without interpretation: `mailto:` links, `tel:` links, structured data markup, and `<meta>` author fields. Each yields a contact whose source URL is the page it was found on.
- An AI step that reads a captured team or about page and identifies **named people and their stated roles** — a job that is genuinely interpretation. It is given the page text and returns people with the text that names them. It is **never** asked to produce an email address, and its output schema has no field for one.
- Role classification against configured seniority levels, so "Managing Director" and "Head of Digital" can be ranked without a human reading every record.
- A **deliverability check** that confirms the domain of a published address can receive mail, by looking up its mail records only. No mailbox probing.

**Explicitly not built**

- No email pattern guessing. No permutation generation. No verification-by-bounce. There is no code path that constructs an address, and the absence is asserted by a test.

**Data model**

- Contacts gain seniority, role source, extraction method and the AI invocation where one was involved, so a published fact and an interpreted one are distinguishable.

## Capabilities

### New Capabilities

- `decision-maker-research`: Finding the people at a company who could be contacted, from what the company itself published on pages the platform fetched, recording the URL for every claim, never constructing or guessing a contact detail, and keeping a published fact distinguishable from an interpreted one.

### Modified Capabilities

- `lead-data-model`: adds seniority, extraction method, role provenance and invocation reference to `contacts`, and strengthens the existing constraint so a contact detail must name the method that produced it.
- `product-configuration`: adds seniority levels, decision-maker role patterns, and the conventional paths that may be fetched.

## Impact

- New Nest module `apps/api/src/contact-research/`.
- New prompt in `packages/ai` for people extraction from page text.
- One new migration in `packages/database` altering `contacts`.
- Reuses the shared `robots.txt` evaluator and per-host rate limiter.
- Depends on `add-website-analysis` and `add-ai-provider-abstraction`.

## Non-goals

Deliberately deferred, or refused outright:

- **Guessing, generating or permuting email addresses.** Refused, not deferred. There will be no such code path.
- **SMTP mailbox probing.** Connecting to a mail server to ask whether a mailbox exists is intrusive, unreliable and widely treated as abuse. Only DNS mail records are checked.
- **LinkedIn.** Its terms prohibit automated collection. A LinkedIn profile URL is stored when the company publishes it on its own site.
- **Paid contact-data providers.** They can be added later as another extraction method with a recorded source; none is integrated here.
- **Scoring the lead or drafting a message** — later changes.
- **Storing personal data beyond what a company published for business contact.** No personal addresses, no personal phone numbers, no data about people who are not presented as business contacts.
