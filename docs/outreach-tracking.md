# Outreach Tracking

Records what happens to outreach messages after they are sent, classifies replies, and advances the lead lifecycle through configured transitions.

## Endpoints

### Record a send

```
POST /api/outreach/:id/sent
```

Body:

```json
{
  "sentAt": "2026-08-13T10:00:00.000Z",
  "means": "gmail"
}
```

Moves the outreach from `approved` to `sent`. The caller supplies `sentAt` because sending happens outside the system. The database enforces `sentAt >= approvedAt`, so backdated sends are refused.

### Classify a reply

```
POST /api/outreach/:id/responses/classify
```

Body:

```json
{
  "replyText": "I'm interested in your services."
}
```

Returns a proposed category without writing anything:

```json
{
  "categoryId": "interested",
  "basisText": "interested",
  "isClassified": true,
  "proposedTransition": "contacted"
}
```

If the model quotes text that does not appear in the reply, the classification is discarded and `categoryId` is `unclassified`.

### Record a response

```
POST /api/outreach/:id/responses
```

Body:

```json
{
  "categoryId": "interested",
  "receivedAt": "2026-08-13T11:00:00.000Z",
  "body": "Yes, tell me more.",
  "proposedCategoryId": "interested"
}
```

Records the response and applies the lead transition declared by the category. `categoryId` must be one of the configured response categories.

### Record no response

```
POST /api/outreach/:id/no-response
```

Body:

```json
{
  "receivedAt": "2026-08-13T11:00:00.000Z"
}
```

Records a `no_response` after the configured `NO_RESPONSE_INTERVAL_DAYS`. Before that interval the request is refused.

### Do-not-contact management

```
POST /api/companies/:id/do-not-contact
POST /api/companies/:id/clear-do-not-contact
POST /api/contacts/:id/do-not-contact
POST /api/contacts/:id/clear-do-not-contact
```

Set or clear do-not-contact markers. Drafting refuses marked companies and contacts before any model call.

## Response categories

Configured in `@mela/config` as `DEFAULT_RESPONSE_CATEGORIES`. Each category declares:

- `id` — category identifier
- `name` — display name
- `proposedTransition` — the lead status to move to on confirmation

The configuration validator checks that every proposed transition exists in the lead lifecycle map, so an invalid category fails at startup rather than at runtime.

## Analytics

```
GET /api/analytics/outreach?segment=industry
```

Segments: `industry`, `service`, `opportunityCategory`, `priorityBand`, `scoreDecile`.

Each aggregate returns:

```json
{
  "segment": "industry",
  "value": "technology",
  "sent": 130,
  "responded": 45,
  "unrecorded": 85,
  "responseRate": 0.346,
  "belowMinimumSampleSize": false
}
```

`unrecorded` is excluded from both numerator and denominator. `belowMinimumSampleSize` is true when `sent < MINIMUM_REPORTING_SAMPLE_SIZE`.

## Do-not-contact enforcement

Three layers:

1. **Drafting** refuses before any model call.
2. **Outreach write helper** refuses.
3. **Database trigger** refuses inserts for marked companies and contacts.

There is no override parameter on any endpoint.
