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

## Enums

### lead_status

`new`, `qualified`, `unqualified`, `contacted`, `responded`, `meeting_scheduled`, `proposal_sent`, `negotiation`, `closed_won`, `closed_lost`, `on_hold`, `cancelled`, `expired`, `renewal_due`

### lead_priority

`critical`, `high`, `medium`, `low`, `none`

### outreach_channel

`email`, `linkedin`, `whatsapp`

### outreach_status

`draft`, `approved`, `sent`, `delivered`, `opened`, `replied`, `bounced`, `failed`

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
