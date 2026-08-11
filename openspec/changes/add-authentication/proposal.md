# Add Authentication

**Roadmap coverage:** the `Auth: intentionally skipped initially (Better Auth / Auth.js later)` line of the decided stack.

## Why

Authentication was skipped deliberately, and the reasoning held while the platform was an empty shell on localhost. It stops holding once the dashboard exists: the web application now exposes companies, contacts with real people's published email addresses, generated messages awaiting approval, and endpoints that spend money on model calls. An unauthenticated API reachable on a network is a data-protection problem and a billing problem at the same time.

This change is deliberately independent of the pipeline. It touches no discovery, analysis, scoring or outreach logic, which is why it can be built in parallel with any of them.

## What Changes

**Authentication**

- Email-and-password sessions for a small, closed set of operator accounts. No public sign-up: accounts are created by an existing operator or by a documented command.
- Session cookies that are HTTP-only, `Secure` outside development, and `SameSite`, with server-side session records that can be revoked.
- Rate limiting on authentication attempts, and a generic failure message that does not reveal whether an account exists.

**Authorization**

- Two roles: **operator**, who can do everything the product does, and **viewer**, who can read but cannot approve outreach, mark do-not-contact, or trigger work that spends money.
- Every API route is protected by default. Access is granted per route explicitly, so a new route added without a decision is closed rather than open.
- `/health` remains unauthenticated, because a health check that needs credentials is not a health check.

**Attribution**

- Approvals, rejections, do-not-contact markers and manual send records carry the account that performed them. "A human approved this" becomes "this person approved this, at this time".

**Auditing**

- An append-only record of authentication events and of the consequential actions, retained independently of the records they refer to.

## Capabilities

### New Capabilities

- `authentication`: Operator accounts, sessions and roles for the platform — closed by default at every route, revocable, rate-limited, with consequential actions attributed to the person who took them.

### Modified Capabilities

- `lead-data-model`: adds the actor reference to approvals, rejections, do-not-contact markers and send records.
- `developer-environment`: adds authentication configuration, the account-creation command, and removes the documented local-only posture once the applications are protected.
- `dashboard`: adds sign-in, sign-out, the role-dependent interface, and the attribution shown on approvals.

## Impact

- New Nest module `apps/api/src/auth/` and new routes and middleware in `apps/web`.
- New dependency: an authentication library from the decided stack, plus a password hashing implementation.
- One new migration adding accounts, sessions, an audit log and actor references.
- Every existing API route gains a guard; every existing API test gains an authenticated context.

## Non-goals

Deferred:

- **Public sign-up, email verification and password reset flows.** A closed set of accounts created by command needs none of them, and each is an unauthenticated surface.
- **Single sign-on, OAuth providers, SAML.** No organisation requires it.
- **Multi-tenancy.** All accounts see the same data; separating tenants is a data model change, not an auth change.
- **Fine-grained per-record permissions.** Two roles cover the actual distinction, which is whether someone may take consequential action.
- **Multi-factor authentication.** Worth adding; it is a change of its own and should not delay closing the open doors.
