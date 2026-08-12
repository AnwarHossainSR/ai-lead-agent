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
| email | TEXT | Email address |
| phone | TEXT | Phone number |
| name | TEXT | Contact name |
| title | TEXT | Job title |
| linkedin_url | TEXT | LinkedIn profile URL |
| source_url | TEXT | URL where contact was found |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Constraints:**
- `contacts_company_id_fk` - Foreign key to companies (CASCADE DELETE)
- `contacts_source_url_check` - Requires `source_url` when `email` or `phone` is present

### website_analysis

Stores AI analysis results for company websites.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| company_id | UUID | Foreign key to companies |
| analysis_url | TEXT | URL that was analyzed |
| observations | JSONB | Business observations |
| business_opportunities | JSONB | Identified opportunities |
| technology_evidence | JSONB | Technology stack evidence |
| overall_score | INTEGER | Overall score (0-100) |
| confidence_score | INTEGER | Confidence in analysis (0-100) |
| created_at | TIMESTAMP | Creation timestamp |

**Constraints:**
- `website_analysis_overall_score_check` - Score must be 0-100
- `website_analysis_confidence_score_check` - Score must be 0-100

**Indexes:**
- `website_analysis_company_created_idx` (on `company_id, created_at DESC`)

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

Tracks outreach attempts to contacts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| lead_id | UUID | Foreign key to leads |
| contact_id | UUID | Foreign key to contacts |
| channel | outreach_channel | Communication channel |
| status | outreach_status | Current status |
| message_content | TEXT | Message body |
| approved_at | TIMESTAMP | Approval timestamp |
| sent_at | TIMESTAMP | Send timestamp |
| opened_at | TIMESTAMP | Open timestamp |
| replied_at | TIMESTAMP | Reply timestamp |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

**Constraints:**
- `outreach_lead_id_fk` - Foreign key to leads
- `outreach_contact_id_fk` - Foreign key to contacts
- `outreach_sent_requires_approval_check` - Cannot be sent without approval
- `outreach_sent_after_approval_check` - Sent timestamp must be after approval

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
