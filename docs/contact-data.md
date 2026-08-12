# Contact Data

## What Is Collected

Contact research collects business contact information for people at companies. The system stores:

| Field | Source | Required |
|-------|--------|----------|
| Name | Structured data, model extraction | Yes |
| Job Title | Structured data, model extraction | No |
| Email | mailto links, structured data | No |
| Phone | tel links, structured data | No |
| LinkedIn URL | Structured data | No |
| Seniority | Classified from job title | No |
| Mail Deliverability | MX record lookup | No |

## How It's Collected

### Deterministic Extraction

1. **mailto links** — email addresses explicitly linked with `mailto:` in HTML
2. **tel links** — phone numbers explicitly linked with `tel:` in HTML
3. **Structured data** — JSON-LD `Person` and `Organization` markup
4. **Visible addresses** — strict pattern matching on rendered text

### Model Extraction

The AI model extracts people from page text. The model:
- Receives page text and URL
- Returns names, roles, and the text that names them (namingText)
- Does NOT receive or return email/phone fields
- Output is validated against a schema with no contact detail fields

## Grounding Rules

Every extracted person must pass validation:

1. **Naming text must appear in the page** — the model cannot invent people
2. **Name must not contain an email address** — prevents storing emails as names
3. **Role must not contain an email address** — prevents storing emails as roles
4. **Source URL required** — every contact detail must carry the URL it was found at

## What Is NOT Collected

- **No guessed addresses** — email patterns, permutation rules, or domain-based generation are refused
- **No SMTP probing** — deliverability checks use DNS lookup only
- **No address construction** — no code path can construct an email from a name and domain
- **No non-business contacts** — only people presented in a business capacity are stored

## Deletion

All contacts for a company can be deleted via the API:
- `DELETE /api/companies/:id/contacts`
- Cascades from company deletion

## Manual Entry

Contacts can be manually entered via the API:
- `POST /api/companies/:id/contacts`
- Requires a source URL (the URL where the contact was observed)
- Extraction method is set to `manual_entry`

## How Deletion Works

- Deleting a company cascades to delete all its contacts
- Deleting contacts for a company removes all contact records
- The `contact_research_runs` table retains historical records of research runs

## Data Retention

- Contact records are retained until explicitly deleted
- Research run records are retained for audit purposes
- No automatic expiry or cleanup
