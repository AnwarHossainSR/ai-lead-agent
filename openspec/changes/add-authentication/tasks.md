# Tasks — Add Authentication

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Configuration and environment

- [ ] 1.1 Add authentication configuration to `packages/config`: session lifetime, absolute maximum lifetime, Argon2id parameters, rate limit window and thresholds, and the minimum password strength
- [ ] 1.2 Add `SESSION_SECRET` and the authentication variables to the API env schema and `.env.example` with a `.describe()` on each
- [ ] 1.3 Refuse startup outside development when the session secret is missing, short, or equal to the committed placeholder
- [ ] 1.4 Add tests: a missing secret aborts naming the variable, the placeholder is refused outside development, the secret never appears in output
- [ ] 1.5 Verify: `pnpm --filter @mela/config lint typecheck test` passes

## 2. Schema

- [ ] 2.1 Add the `account_role` enum and the `accounts` table with a unique email, password hash, role, disabled marker and timestamps
- [ ] 2.2 Add the `sessions` table with account, expiry, revocation and last-seen, distinguishing expired from revoked
- [ ] 2.3 Add the `audit_log` table and the trigger refusing `UPDATE` and `DELETE`
- [ ] 2.4 Add the attribution columns to `outreach`, `companies` and `contacts` with `ON DELETE RESTRICT` and the `CHECK` pairs requiring an actor whenever the action timestamp is present
- [ ] 2.5 Add write helpers for accounts, sessions and audit entries, with read helpers that never return a password hash
- [ ] 2.6 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [ ] 2.7 Add integration tests covering every scenario in `specs/lead-data-model/spec.md`, including raw `UPDATE`s against the append-only trigger and the attribution constraints
- [ ] 2.8 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. Credentials and sessions

- [ ] 3.1 Implement Argon2id hashing at the configured parameters, with a fixed dummy hash compared when an account does not exist
- [ ] 3.2 Implement sign-in returning an identical message and comparable timing for an unknown address and a wrong password
- [ ] 3.3 Implement session creation, sliding expiry with an absolute maximum, sign-out and revocation
- [ ] 3.4 Set the cookie HTTP-only, same-site restricted, and secure outside development
- [ ] 3.5 Implement rate limiting per account and per source, indistinguishable between known and unknown addresses, and not blocking other accounts
- [ ] 3.6 Add unit and integration tests for every scenario in the credentials, sessions and rate-limiting requirements
- [ ] 3.7 Verify: `pnpm --filter @mela/api lint typecheck test` passes

## 4. Deny by default

- [ ] 4.1 Register the global guard rejecting every request without a valid session
- [ ] 4.2 Add the `@Public()` decorator and apply it to the health endpoint only
- [ ] 4.3 Add the route-coverage test enumerating every registered route and asserting each is guarded or explicitly public
- [ ] 4.4 Add a shared test helper issuing an authenticated context, and update every existing API test to use it
- [ ] 4.5 Verify: `pnpm --filter @mela/api lint typecheck test` passes with every previously passing test still passing

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
