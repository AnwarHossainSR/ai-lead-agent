# Design — Add Authentication

## Context

Authentication was skipped deliberately and the reasoning was recorded: the platform was a shell on localhost. That reasoning expired when the dashboard shipped. The API now serves real people's published contact details, generated messages awaiting approval, and endpoints that spend money per call.

The existing shape helps. `apps/api` already has a global Zod validation pipe, a global `/api` prefix with `/health` deliberately excluded, structured logging that keeps credentials out of output, and an environment loader that strips raw values from validation errors. The database already enforces its important rules with `CHECK` constraints rather than trusting the application.

This change is independent of the pipeline — it touches no discovery, analysis, scoring or outreach *logic* — which is why it can proceed in parallel with pipeline work. It does touch every pipeline *route*, which is a merge consideration rather than a design one.

## Goals / Non-Goals

**Goals:**

- Close every door by default, so a new route is protected without anyone remembering.
- Make sessions revocable server-side.
- Turn "a human approved this" into "this person approved this".
- Keep the health endpoint public.

**Non-Goals:** public sign-up, password reset, email verification, SSO, multi-tenancy, per-record permissions, multi-factor.

## Decisions

### D1 — Deny by default, allow by explicit declaration

A global `AuthGuard` registered with `APP_GUARD` rejects every request. Public routes carry an explicit `@Public()` decorator; `/health` is the only one at first.

**Why this direction:** the alternative — guards applied per controller — means a route added in six months is open until somebody notices. The failure mode of deny-by-default is a 401 during development, which is loud. The failure mode of allow-by-default is a silent data exposure.

A test enumerates every registered route and asserts each is either guarded or carries `@Public()`, so a new public route is a deliberate, reviewable act.

### D2 — Server-side sessions, not stateless tokens

An opaque session id in an HTTP-only cookie, with a `sessions` row carrying account, expiry, revocation and last-seen.

**Why not a JWT:** the requirement is revocation. A stateless token cannot be revoked without a denylist, which is a session table with extra steps and worse ergonomics. There is one API process and one database; a session lookup per request is a primary-key read.

Cookie: `httpOnly`, `sameSite: 'lax'`, `secure` outside development, `path: '/'`, expiry matching the session. Sliding expiry with an absolute maximum, so an idle session ends and a long-lived one still eventually requires signing in again.

### D3 — Argon2id, and identical failures

Passwords hashed with Argon2id at parameters held in configuration. Sign-in performs a hash comparison **even when the account does not exist**, against a fixed dummy hash, so the response time does not distinguish the two cases. The message is the same either way.

Rate limiting is per account and per source address over a configured window, and the throttled response for an unknown address is indistinguishable from the throttled response for a known one.

### D4 — Two roles, drawn at "may take consequential action"

`operator` and `viewer`. The line is not read-versus-write; it is whether an action is **irreversible or costly**:

- approving or rejecting outreach,
- recording a manual send,
- setting or clearing a do-not-contact marker,
- triggering work that calls a model.

A viewer can read everything and can enqueue nothing that spends.

**Why two and not five:** the product has one operator today. Roles that model an organisation nobody has are speculative structure. Two roles encode the one distinction that genuinely exists.

Enforced with a `@RequiresRole('operator')` decorator read by the same guard, and asserted in the UI by not rendering the control **and** in the API by refusing the request. The UI check is convenience; the API check is the control.

### D5 — Attribution as `NOT NULL` columns, and accounts are disabled rather than deleted

```sql
-- outreach gains:
approved_by uuid references accounts on delete restrict,
rejected_by uuid references accounts on delete restrict,
sent_recorded_by uuid references accounts on delete restrict,
check (approved_at is null or approved_by is not null),
check (rejected_at is null or rejected_by is not null),
check (sent_at is null or sent_recorded_by is not null)

-- companies and contacts gain:
do_not_contact_by uuid references accounts on delete restrict,
check (do_not_contact_at is null or do_not_contact_by is not null)
```

`ON DELETE RESTRICT` plus a `disabled_at` column: an account is disabled, never deleted, because deleting it would erase the record of who approved a message that went to a real company.

The `CHECK` pairs mean a hand-written `UPDATE` cannot record an approval with no approver — the same construction as `sent_at` requiring `approved_at`.

### D6 — Audit log, append-only in the database

```sql
audit_log(
  id uuid pk,
  account_id uuid references accounts on delete set null,
  event text not null,
  subject_type text, subject_id uuid,
  outcome text not null,
  source_address inet,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

Append-only enforced by a trigger raising on `UPDATE` and `DELETE`, and by the application role holding no such grant. `account_id` is `ON DELETE SET NULL` while accounts are never deleted — belt and braces so an audit row survives regardless.

`detail` never carries a password, a hash, a session id or a model prompt. A test asserts the writer's shape.

### D7 — Web: middleware for the boundary, server components for the rest

Next.js middleware checks for a session cookie and redirects to sign-in, so an unauthenticated request never reaches a data fetch. The session is verified against the API — the middleware check is a cheap gate, not the authority.

Sign-in is a Server Action posting to the API and setting the cookie. The role travels in the session response and drives which controls render.

### D8 — Testing

- **The route-coverage test:** enumerate every registered route; assert each is guarded or explicitly `@Public()`. This is the test that keeps D1 true.
- **Unit:** identical failure for unknown account and wrong password, including timing; rate limiting per account and per source; the placeholder-secret refusal outside development.
- **Integration, real PostgreSQL:** the attribution `CHECK` pairs via raw `UPDATE`; the append-only trigger refusing `UPDATE` and `DELETE`; `ON DELETE RESTRICT` refusing deletion of a referenced account; duplicate email refused; read helpers returning no hash.
- **API:** viewer refused on each consequential action, operator permitted; expired and revoked sessions rejected; sign-out invalidating immediately.
- **Playwright:** unauthenticated redirect; sign-in and sign-out; a viewer seeing no approval control, and the API refusing when the request is made directly anyway.
- **Every existing API test** gains an authenticated context; a shared test helper issues a session so the change is mechanical.

## Risks / Trade-offs

- **Retrofitting a guard across every existing route touches a lot of files** → deny-by-default means the change is one global registration plus one decorator on `/health`; the volume is in the tests, which is the right place for it.
- **Session lookup per request adds a query** → a primary-key read against a small table, and revocation is a hard requirement that stateless tokens do not meet.
- **No password reset means a locked-out operator needs the command line** → acceptable for a closed set of accounts, and it removes an unauthenticated attack surface. Revisit when there is more than one person.
- **Two roles will not fit a future team** → adding a role is a configuration and guard change; inventing the hierarchy now would be designing for an organisation that does not exist.
- **Merge conflicts with concurrent pipeline work** → this change adds decorators and columns rather than altering pipeline logic; applying it after a pipeline change, or before starting one, keeps the conflict surface small.
- **No multi-factor** → stated as deferred rather than dismissed; it should not delay closing an open API.
