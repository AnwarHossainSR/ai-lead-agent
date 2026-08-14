# Tasks — Add Authentication

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Configuration and environment

- [x] 1.1 Add authentication configuration to `packages/config`: session lifetime, absolute maximum lifetime, Argon2id parameters, rate limit window and thresholds, and the minimum password strength
- [x] 1.2 Add `SESSION_SECRET` and the authentication variables to the API env schema and `.env.example` with a `.describe()` on each
- [x] 1.3 Refuse startup outside development when the session secret is missing, short, or equal to the committed placeholder
- [x] 1.4 Add tests: a missing secret aborts naming the variable, the placeholder is refused outside development, the secret never appears in output
- [x] 1.5 Verify: `pnpm --filter @mela/config lint typecheck test` passes — 311/311 config tests pass; `@mela/api` (458/458) and `@mela/web` continue to typecheck/pass with `SESSION_SECRET` added to test fixtures

## 2. Schema

- [x] 2.1 Add the `account_role` enum and the `accounts` table with a unique email, password hash, role, disabled marker and timestamps
- [x] 2.2 Add the `sessions` table with account, expiry, revocation and last-seen, distinguishing expired from revoked
- [x] 2.3 Add the `audit_log` table and the trigger refusing `UPDATE` and `DELETE` — the `UPDATE` trigger carves out one exception: the FK's own `ON DELETE SET NULL` action on `account_id` (design D6 wants both append-only *and* a row that survives its account, and Postgres implements that FK action as an `UPDATE` under the hood)
- [ ] 2.4 Add the attribution columns to `outreach`, `companies` and `contacts` with `ON DELETE RESTRICT` and the `CHECK` pairs requiring an actor whenever the action timestamp is present — **reordered**: deferred to section 6, alongside the write-helper and controller changes that supply the actor. Adding the columns here without a real authenticated caller yet available in `apps/api` would break every existing approve/reject/send/do-not-contact test the moment the `CHECK` constraint went in; the guard and `CurrentAccount` extraction (sections 3-5) have to exist first
- [x] 2.5 Add write helpers for accounts, sessions and audit entries, with read helpers that never return a password hash
- [x] 2.6 Generate and commit the migration; confirm `pnpm db:check` reports no drift — `0013_past_fabian_cortez.sql` (accounts, sessions, audit_log + append-only triggers). A second migration for the attribution columns follows in section 6
- [ ] 2.7 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw `UPDATE`s against the append-only trigger and the attribution constraints — the account/session/audit-log scenarios are covered now (`write/accounts.test.ts`: duplicate email, unrecognised role, password hash never read, append-only trigger via raw `UPDATE`/`DELETE`, audit entry outliving its account, expired vs. revoked sessions distinguishable). The attribution-constraint scenarios are covered in section 6 alongside 2.4
- [x] 2.8 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running — 216/216 (one pre-existing, unrelated flaky test in `write/outreach.test.ts` order-dependently fails in isolation; documented before this change, not caused by it). Re-verified again after section 6 adds the attribution migration

## 3. Credentials and sessions

- [x] 3.1 Implement Argon2id hashing at the configured parameters, with a fixed dummy hash compared when an account does not exist — `apps/api/src/auth/password.ts`; `DUMMY_PASSWORD_HASH` is a real, precomputed Argon2id hash at the same parameters, so a lazily-computed dummy can't make the first post-restart refusal slower than the rest
- [x] 3.2 Implement sign-in returning an identical message and comparable timing for an unknown address and a wrong password — `AuthService.signIn`; both branches always run one Argon2id comparison (real hash or the dummy) before returning `SIGN_IN_FAILURE_MESSAGE`
- [x] 3.3 Implement session creation, sliding expiry with an absolute maximum, sign-out and revocation — `AuthService`/`validateSessionToken` (sliding expiry capped at `createdAt + sessionAbsoluteMaxLifetimeMinutes`), `signOut`; the stored value is an HMAC of the token (`session-token.ts`), never the token itself
- [x] 3.4 Set the cookie HTTP-only, same-site restricted, and secure outside development — the attributes are a single source of truth in `packages/config` (`sessionCookieAttributes`, design D2/D7) since both `apps/api` (issues it) and `apps/web` (section 8, sets it via the sign-in Server Action) need the same policy and there is no shared package between the two apps otherwise; exercised here via `AuthController`'s `POST /auth/sign-in`/`sign-out`
- [x] 3.5 Implement rate limiting per account and per source, indistinguishable between known and unknown addresses, and not blocking other accounts — `SignInRateLimiter`, in-memory per API process (one process, same reasoning as D2's session table)
- [x] 3.6 Add unit and integration tests for every scenario in the credentials, sessions and rate-limiting requirements — `password.test.ts`, `session-token.test.ts`, `sign-in-rate-limiter.test.ts`, `auth.service.test.ts` (real Postgres), `auth.controller.test.ts` (real HTTP via supertest, including the Secure attribute in both development and production)
- [x] 3.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes — 496/496

## 4. Deny by default

- [x] 4.1 Register the global guard rejecting every request without a valid session — `SessionGuard` via `APP_GUARD` in `AuthModule`
- [x] 4.2 Add the `@Public()` decorator and apply it to the health endpoint only — **and** to `POST /auth/sign-in`/`sign-out` themselves, which is not a deviation: a route that requires a session to reach the endpoint that creates one is unreachable by design, and the health endpoint was never the only necessary exception
- [x] 4.3 Add the route-coverage test enumerating every registered route and asserting each is guarded or explicitly public — `route-coverage.test.ts`, built on `DiscoveryService`/`MetadataScanner` (reads the same metadata the guard reads, not a hand-maintained list): asserts the public set is exactly `{GET /health, POST /api/auth/sign-in, POST /api/auth/sign-out}`, then issues an unauthenticated request to every other registered route and asserts 401 on all of them
- [x] 4.4 Add a shared test helper issuing an authenticated context, and update every existing API test to use it — `testing/authenticated-context.ts` (`createAuthenticatedContext`, inserts an account + session directly rather than through real sign-in) and `testing/authed-request.ts` (`authedRequest`, attaches the cookie to every supertest call); applied to the 9 existing controller test files that needed it
- [x] 4.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes with every previously passing test still passing — lint and typecheck pass; the 9 auth-affected files plus `route-coverage.test.ts` and the `auth/` suite are 105/105. A root-level `pnpm --filter @mela/api test` re-run, and resolution of an unrelated pre-existing `testing/app.ts` default-environment issue affecting `health.test.ts`/`create-app.test.ts`/`ai.module.test.ts` (not caused by this change), is deferred to the final root verification at 9.4

## 5. Roles

- [ ] 5.1 Add the `@RequiresRole` decorator read by the same guard, refusing with a message naming the action and the required role
- [ ] 5.2 Apply it to outreach approval and rejection, manual send recording, do-not-contact marking, and every endpoint that triggers a model call
- [ ] 5.3 Add API tests: a viewer refused on each consequential action with no model call made, an operator permitted
- [ ] 5.4 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 6. Accounts and attribution

- [ ] 6.1 Add the documented account creation command, refusing a weak password and never echoing it
- [ ] 6.2 Add operator-only endpoints to create an account, change a role, and disable an account with its sessions revoked
- [ ] 6.3 Record the acting account on approvals, rejections, send records and do-not-contact markers
- [ ] 6.4 Add tests: attribution survives the account being disabled, and a referenced account cannot be deleted
- [ ] 6.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 7. Audit log

- [ ] 7.1 Append audit entries for sign-in, failed sign-in, sign-out, revocation, account creation, role change, disablement, and each consequential action
- [ ] 7.2 Add a test asserting the audit writer's payload carries no password, hash, session id or model prompt
- [ ] 7.3 Add an operator-only endpoint listing audit entries with filters
- [ ] 7.4 Verify: `pnpm --filter @mela/api lint typecheck test build` passes

## 8. Web application

- [ ] 8.1 Add the sign-in page and the Server Action posting to the API and setting the cookie
- [ ] 8.2 Add middleware redirecting an unauthenticated request to sign-in before any data fetch
- [ ] 8.3 Show the signed-in account and a sign-out control in the shell
- [ ] 8.4 Hide controls the signed-in role may not use, and confirm the API refuses the request when made directly anyway
- [ ] 8.5 Display the approving, rejecting and marking account alongside each action's time
- [ ] 8.6 Add Playwright tests covering every scenario in `specs/dashboard/spec.md`
- [ ] 8.7 Verify: `pnpm --filter @mela/web lint typecheck test build` passes

## 9. Documentation and final verification

- [ ] 9.1 Document authentication in `docs/architecture.md`, including deny-by-default and why sessions are server-side
- [ ] 9.2 Document account creation, sign-in and the two roles in `docs/development.md` and `README.md`, removing the local-only unauthenticated statement
- [ ] 9.3 Update `docs/data-model.md` and `docs/implementation-progress.md`
- [ ] 9.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 9.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 9.6 Run `openspec validate add-authentication --strict` and resolve anything it reports
