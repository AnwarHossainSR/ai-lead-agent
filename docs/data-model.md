# Data Model

## Overview

The MELA data model uses PostgreSQL with Drizzle ORM. All tables use UUID primary keys and include `created_at` and `updated_at` timestamps.

## Tables

### companies

Stores company information discovered through web scraping.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Company name |
| domain | TEXT | Primary domain |
| normalized_domain | TEXT | Normalized domain (unique when present) |
| website_url | TEXT | Full website URL |
| industry | TEXT | Industry classification |
| country | TEXT | Country code |
| city | TEXT | City name |
| employee_count | INTEGER | Number of employees |
| revenue_range | TEXT | Revenue range |
| founded_year | INTEGER | Year founded |
| description | TEXT | Company description |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `companies_normalized_domain_idx` (partial unique on `normalized_domain` WHERE NOT NULL)
- `companies_industry_idx` (on `industry`)
- `companies_country_idx` (on `country`)

### contacts

Stores contact information for company representatives.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_id | UUID | Foreign key to companies |
| name | TEXT | Contact name |
| job_title | TEXT | Job title |
| linkedin_url | TEXT | LinkedIn profile URL |
| email | TEXT | Email address |
| phone | TEXT | Phone number |
| certainty | certainty_enum | observed (deterministic) or inferred (model) |
| extraction_method | contact_extraction_method_enum | deterministic, model_interpretation, or manual_entry |
| seniority_id | TEXT | Seniority level ID (c-level, vp, director, etc.) |
| role_source_url | TEXT | URL where the role was stated |
| mail_deliverability | mail_deliverability_enum | receivable, not_receivable, or unknown |
| ai_invocation_id | UUID | Reference to AI invocation (for model_interpretation) |
| research_source | TEXT | How the contact was obtained |
| source_url | TEXT | URL where contact was found |
| is_example | BOOLEAN | Whether this is example data |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Constraints:**
- `contacts_company_id_fk` - Foreign key to companies (CASCADE DELETE)
- `contacts_ai_invocation_id_ai_invocations_id_fk` - Foreign key to ai_invocations (SET NULL on delete)
- `contacts_contact_details_need_a_source` - Requires `source_url` when `email` or `phone` is present
- `contacts_interpreted_requires_invocation` - model_interpretation requires ai_invocation_id
- `contacts_seniority_requires_title` - seniority_id requires job_title

### contact_research_runs

Stores records of contact research runs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_id | UUID | Foreign key to companies |
| fetched_pages | JSONB | List of URLs fetched during research |
| skipped_pages | JSONB | List of URLs skipped with reasons |
| outcome | contact_research_outcome_enum | contacts_found, none_found, blocked, skipped, or failed |
| found_count | INTEGER | Number of contacts found |
| rejected_count | INTEGER | Number of contacts rejected |
| rejection_reasons | JSONB | Reasons for rejections |
| created_at | TIMESTAMP | Creation timestamp |

**Constraints:**
- `contact_research_runs_company_id_companies_id_fk` - Foreign key to companies (CASCADE DELETE)

**Indexes:**
- `contact_research_runs_company_id_idx` (on `company_id`)

### website_analysis

Stores analysis results for company websites.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_id | UUID | Foreign key to companies |
| outcome | website_analysis_outcome | Analysis outcome (completed, partial, blocked, skipped, failed) |
| failure_reason | TEXT | Reason for non-completed outcome |
| analyzed_url | TEXT | URL that was analyzed |
| http_status | INTEGER | HTTP response status code |
| desktop_screenshot_path | TEXT | Path to desktop screenshot (relative to artifact root) |
| mobile_screenshot_path | TEXT | Path to mobile screenshot (relative to artifact root) |
| rendered_html_path | TEXT | Path to rendered HTML (relative to artifact root) |
| audit_report_path | TEXT | Path to Lighthouse audit report (relative to artifact root) |
| unverified_override | BOOLEAN | Whether analysis was forced for unverified company |
| performance_score | INTEGER | Lighthouse performance score (0-100, NULL = not measured) |
| accessibility_score | INTEGER | Lighthouse accessibility score (0-100, NULL = not measured) |
| seo_score | INTEGER | Lighthouse SEO score (0-100, NULL = not measured) |
| mobile_score | INTEGER | Lighthouse mobile score (0-100, NULL = not measured) |
| ux_score | INTEGER | Lighthouse UX score (0-100, NULL = not measured) |
| technology_stack | JSONB | Detected technologies |
| observations | JSONB | Page observations (issues found) |
| business_opportunities | JSONB | Identified business opportunities |
| summary | TEXT | Human-readable analysis summary |
| is_example | BOOLEAN | Whether this is example data |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Constraints:**
- `website_analysis_company_id_fk` - Foreign key to companies (CASCADE DELETE)
- `website_analysis_performance_score_range` - Score must be 0-100 or NULL
- `website_analysis_accessibility_score_range` - Score must be 0-100 or NULL
- `website_analysis_seo_score_range` - Score must be 0-100 or NULL
- `website_analysis_mobile_score_range` - Score must be 0-100 or NULL
- `website_analysis_ux_score_range` - Score must be 0-100 or NULL
- `website_analysis_failure_reason_required` - Failure reason required for non-completed outcomes
- `website_analysis_no_scores_on_failure` - No scores on blocked, skipped, or failed analyses

**Indexes:**
- `website_analysis_company_created_idx` (on `company_id, created_at DESC`)
- `website_analysis_company_outcome_idx` (on `company_id, outcome`)

### technology_detections

Stores technology detections from website analysis.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| analysis_id | UUID | Foreign key to website_analysis |
| company_id | UUID | Foreign key to companies |
| fingerprint_id | TEXT | Identifier of the matched fingerprint |
| technology_id | TEXT | Human-readable technology name |
| category | TEXT | Technology category |
| certainty | certainty | Whether detection was observed or inferred |
| matched_in | TEXT | Location where pattern matched (observed only) |
| matched_text | TEXT | Text that matched the pattern (observed only) |
| version | TEXT | Extracted version string (if present) |
| implied_by | UUID | Detection that implied this one (inferred only) |
| created_at | TIMESTAMP | Creation timestamp |

**Constraints:**
- `technology_detections_analysis_technology_key` - One detection per technology per analysis
- `technology_detections_observed_requires_evidence` - Observed detections must have matched_in and matched_text
- `technology_detections_inferred_requires_implication` - Inferred detections must reference implying detection

**Foreign Keys:**
- `technology_detections_analysis_id_website_analysis_id_fk` - Foreign key to website_analysis (CASCADE DELETE)
- `technology_detections_company_id_companies_id_fk` - Foreign key to companies (CASCADE DELETE)

**Indexes:**
- `technology_detections_technology_id_idx` (on `technology_id`)
- `technology_detections_company_created_idx` (on `company_id, created_at DESC`)

### leads

Stores scored leads for outreach.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_id | UUID | Foreign key to companies (unique) |
| status | lead_status | Current status |
| priority | lead_priority | Priority level |
| total_score | INTEGER | Total score (0-100) |
| score_breakdown | JSONB | Per-component scores |
| explanation | TEXT | Score explanation |
| next_action | TEXT | Recommended next action |
| assigned_to | TEXT | Assigned salesperson |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Constraints:**
- `leads_company_id_unique` - One lead per company
- `leads_total_score_check` - Score must be 0-100
- `leads_explanation_check` - Explanation must not be empty

**Indexes:**
- `leads_status_idx` (on `status`)
- `leads_priority_idx` (on `priority`)
- `leads_score_idx` (on `total_score DESC`)

### outreach

Tracks outreach message drafts, approvals, and state transitions.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| lead_id | UUID | Foreign key to leads |
| channel | outreach_channel | Communication channel |
| subject | TEXT | Message subject (nullable for channels without subjects) |
| message_body | TEXT | Message body |
| status | outreach_status | Current status |
| generated_subject | TEXT | AI-generated subject |
| generated_body | TEXT | AI-generated body |
| is_human_edited | BOOLEAN | Whether a human has edited the text |
| prompt_version | INTEGER | Version of the drafting prompt used |
| ai_invocation_id | UUID | Foreign key to ai_invocations |
| cited_facts | JSONB | Fact identifiers cited in the message |
| approved_at | TIMESTAMP | Approval timestamp |
| approved_by_account_id | UUID | Account that approved (references accounts, RESTRICT) |
| sent_at | TIMESTAMP | Send timestamp |
| sent_means | TEXT | How the send was recorded (e.g. "Gmail") |
| sent_by_account_id | UUID | Account that recorded the send (references accounts, RESTRICT) |
| responded_at | TIMESTAMP | Response timestamp |
| approval_revoked_at | TIMESTAMP | When approval was revoked by editing |
| approved_text_hash | TEXT | MD5 of subject + body at approval time |
| rejection_reason | TEXT | Reason for rejection |
| rejected_at | TIMESTAMP | Rejection timestamp |
| rejected_by_account_id | UUID | Account that rejected (references accounts, RESTRICT) |
| notes | TEXT | Operator notes |
| is_example | BOOLEAN | Whether this is an example record |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Constraints:**
- `outreach_lead_id_fk` - Foreign key to leads
- `outreach_ai_invocation_id_ai_invocations_id_fk` - Foreign key to ai_invocations
- `outreach_generated_requires_invocation` - Generated body requires an AI invocation
- `outreach_sent_requires_approval` - Cannot be sent/replied/bounced without approval
- `outreach_sent_at_requires_approved_at` - Sent timestamp requires approval timestamp
- `outreach_sent_at_not_before_approved_at` - Sent cannot be before approval
- `outreach_responded_at_requires_sent_at` - Response requires sent timestamp
- `outreach_approved_text_hash_matches` - Approved text hash must match current text
- `outreach_rejection_requires_reason` - Rejection requires a non-blank reason
- `outreach_approved_actor_pairs_with_timestamp` - `approved_at`/`approved_by_account_id` are set or cleared together
- `outreach_rejected_actor_pairs_with_timestamp` - `rejected_at`/`rejected_by_account_id` are set or cleared together
- `outreach_sent_actor_pairs_with_timestamp` - `sent_at`/`sent_by_account_id` are set or cleared together

**Indexes:**
- `outreach_lead_status_idx` (on `lead_id`, `status`)

### accounts

Operator/viewer accounts (design D2/D4). Created only via the `create-account` command or `POST /api/accounts` — there is no sign-up.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| email | TEXT | Unique across accounts |
| password_hash | TEXT | Argon2id hash; never returned by a read helper |
| role | account_role | `operator` or `viewer` |
| disabled_at | TIMESTAMP | Set instead of deleting the row (see below) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Constraints:**
- `accounts_email_key` - Unique on `email`

**Note:** accounts referenced by an approval, rejection, send record or do-not-contact marker can never be deleted — every one of those foreign keys is `ON DELETE RESTRICT`. Disabling an account (`disabled_at`) also revokes every session it holds; that is how an account is retired.

### sessions

Server-side sessions (design D2) — an opaque token in an HTTP-only cookie, only its HMAC stored here.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_id | UUID | Foreign key to accounts |
| token_hash | TEXT | HMAC of the session token |
| expires_at | TIMESTAMP | Sliding expiry, capped at an absolute maximum |
| revoked_at | TIMESTAMP | Set on sign-out or when the account is disabled |
| last_seen_at | TIMESTAMP | Updated on each valid use |
| created_at | TIMESTAMP | Creation timestamp |

**Constraints:**
- `sessions_account_id_fk` - Foreign key to accounts

### audit_log

Append-only record of every sign-in, sign-out and consequential action (design D6).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| account_id | UUID | Acting account (references accounts, SET NULL on delete — belt and braces, since accounts are never actually deleted) |
| event | TEXT | e.g. `sign_in`, `sign_in_failed`, `sign_out`, or a slugified `@RequiresRole` action |
| subject_type | TEXT | The kind of thing acted on, if any |
| subject_id | UUID | The specific record acted on, if any |
| outcome | TEXT | `succeeded` or `failed` |
| source_address | INET | Request source address |
| detail | JSONB | Free-form, non-sensitive detail — never a password, hash, session id or model prompt |
| created_at | TIMESTAMP | Creation timestamp |

**Constraints:**
- A database trigger refuses `UPDATE` and `DELETE` against this table — the one exception is the FK's own `ON DELETE SET NULL` action on `account_id`, which Postgres implements as an `UPDATE` under the hood.

### discovery_runs

Tracks company discovery runs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| country_id | TEXT | Country identifier (e.g., "uae") |
| city_id | TEXT | City identifier (optional) |
| industry_id | TEXT | Industry identifier (e.g., "logistics") |
| started_at | TIMESTAMP | Run start time |
| finished_at | TIMESTAMP | Run completion time (nullable while running) |
| outcome | discovery_run_outcome | Final outcome |
| candidate_limit | INTEGER | Maximum candidates to store |
| duration_limit_seconds | INTEGER | Maximum run duration |
| failure_reason | TEXT | Reason for failure (if applicable) |

**Constraints:**
- `discovery_runs_finished_at_after_started_at` - Finished time must be after start time
- `discovery_runs_candidate_limit_positive` - Candidate limit must be >= 1
- `discovery_runs_duration_limit_positive` - Duration limit must be >= 1

**Indexes:**
- `discovery_runs_one_running_per_territory` (partial unique on `country_id, industry_id` WHERE `outcome = 'running'`)
- `discovery_runs_started_at_idx` (on `started_at`)

### discovery_run_sources

Tracks per-source results within a discovery run.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| run_id | UUID | Foreign key to discovery_runs |
| source_id | TEXT | Source identifier (e.g., "file_import") |
| outcome | discovery_source_outcome | Source outcome |
| returned_count | INTEGER | Candidates returned by source |
| stored_count | INTEGER | Candidates stored from source |
| duplicate_count | INTEGER | Duplicate candidates rejected |
| rejected_count | INTEGER | Invalid candidates rejected |
| rejections | JSONB | Rejection reasons with counts |
| note | TEXT | Additional note (e.g., block reason) |

**Constraints:**
- `discovery_run_sources_run_id_fk` - Foreign key to discovery_runs (CASCADE DELETE)
- `discovery_run_sources_returned_non_negative` - Returned count >= 0
- `discovery_run_sources_stored_non_negative` - Stored count >= 0
- `discovery_run_sources_duplicate_non_negative` - Duplicate count >= 0
- `discovery_run_sources_rejected_non_negative` - Rejected count >= 0

**Indexes:**
- `discovery_run_sources_run_source_key` (unique on `run_id, source_id`)

### company_discovery_sources

Tracks which source discovered each company.

| Column | Type | Description |
|--------|------|-------------|
| company_id | UUID | Foreign key to companies |
| source_id | TEXT | Source identifier |
| source_url | TEXT | URL where company was found |
| first_seen_at | TIMESTAMP | When first discovered |
| last_seen_at | TIMESTAMP | When last rediscovered |

**Constraints:**
- `company_discovery_sources_company_id_fk` - Foreign key to companies (CASCADE DELETE)
- `company_discovery_sources_company_source_pk` - Composite primary key on (`company_id, source_id`)
- `company_discovery_sources_source_url_not_blank` - Source URL must not be blank

### verification_checks

Stores individual check results from verification runs.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_id | UUID | Foreign key to companies |
| check_id | TEXT | Check identifier (dns, http, domain-name-match, registry) |
| verdict | verification_verdict | Check outcome (passed, failed, unknown) |
| evidence | TEXT | Human-readable description of what was observed |
| evidence_url | TEXT | URL or identifier where evidence can be inspected |
| verification_run_id | UUID | Run that produced this check result |
| ran_at | TIMESTAMP | When the check was executed |

**Constraints:**
- `verification_checks_company_id_fk` - Foreign key to companies (CASCADE DELETE)
- `verification_checks_evidence_required` - Evidence is required when verdict is passed or failed

**Indexes:**
- `verification_checks_company_ran_at_idx` - on (`company_id, ran_at DESC`)

## Enums

### account_role

`operator`, `viewer` (design D4)

### lead_status

`new`, `qualified`, `unqualified`, `contacted`, `responded`, `meeting_scheduled`, `proposal_sent`, `negotiation`, `closed_won`, `closed_lost`, `on_hold`, `cancelled`, `expired`, `renewal_due`

### lead_priority

`critical`, `high`, `medium`, `low`, `none`

### outreach_channel

`email`, `linkedin`, `whatsapp`

### outreach_status

`draft`, `approved`, `sent`, `delivered`, `opened`, `replied`, `bounced`, `failed`

### verification_verdict

`passed`, `failed`, `unknown`

### company_verification_state

`never_checked`, `verified`, `unverified`, `unreachable`

### website_analysis_outcome

`completed`, `partial`, `blocked`, `skipped`, `failed`

## JSONB Schemas

### website_analysis.observations

```json
{
  "evidence": "string (required)",
  "certainty": "observed | inferred",
  "details": "object"
}
```

### website_analysis.business_opportunities

```json
{
  "evidence": "string (required)",
  "certainty": "observed | inferred",
  "details": "object"
}
```

### website_analysis.technology_evidence

```json
{
  "evidence": "string (required)",
  "certainty": "observed | inferred",
  "details": "object"
}
```
