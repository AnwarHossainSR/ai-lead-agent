# Add AI Research Summary

**Roadmap coverage:** the `AI research summary` stage of the core pipeline, between lead scoring and outreach drafting.

## Why

A scored lead carries a formatted explanation, a list of opportunities, evidenced technology detections and a set of contacts. That is everything an operator needs and none of it is readable in thirty seconds. Before contacting a company, a person needs to know what this business is, what appears to be wrong, what could be offered, and who to speak to — as prose, in one place.

That is summarization, which the product principles assign to a model. It is also the last read-only step before anything is drafted, so it is the right place to surface what the platform does *not* know. A summary that quietly omits the gaps invites an operator to open a conversation with more confidence than the evidence supports.

## What Changes

**A research summary module in `apps/api`**

- A versioned prompt taking a lead's stored facts — company attributes, analysis observations, technology detections, opportunities with their citations, contacts with their sources, the score and its components — and returning a structured summary: what the business appears to do, what was observed about its web presence, the opportunities and what they rest on, who could be contacted, and **an explicit list of what is unknown**.
- The same grounding enforcement as opportunity analysis: every claim in the summary must cite a supplied fact, checked after parsing against the actual input set.
- A **prohibited-claims check** rejecting a summary containing assertions the input cannot support — revenue, headcount, funding, hiring, growth plans, customer counts, strategy — regardless of how they are phrased.
- Regeneration on demand, with the previous summary retained and the prompt version recorded.

**Summaries are labelled as generated**

- Every summary is stored and returned marked as AI-generated with its invocation reference, so nothing downstream and no reader can mistake it for a researched fact.

## Capabilities

### New Capabilities

- `research-summary`: A readable, generated briefing on a scored lead, assembled only from facts the platform already holds, with every claim traceable to one of them, an explicit statement of what is unknown, and no assertion about a company's finances, headcount or plans.

### Modified Capabilities

- `lead-data-model`: adds lead research summaries with their prompt version, invocation reference and cited facts.

## Impact

- New Nest module `apps/api/src/research-summary/`.
- New prompt in `packages/ai`.
- One new migration in `packages/database`.
- Depends on `add-lead-scoring-engine` and everything it depends on.

## Non-goals

Deliberately deferred, or refused:

- **Any statement about revenue, headcount, funding, hiring, growth plans, customers or strategy.** Refused — the platform holds no such data, so anything said about it would be invented.
- **Searching for new information.** The summary reads what is stored. If it needs a fact the platform does not have, the fact is missing, and the summary says so.
- **Writing the outreach message** — `add-outreach-drafting`. A summary is for the operator to read; a draft is for a recipient.
- **Changing the score.** The summary reads the score and its explanation; it does not adjust either.
- **Translating the summary.** Arabic-language output can be added as another prompt version later.
