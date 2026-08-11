# Tasks — Add AI Provider Abstraction

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Package skeleton and configuration

- [x] 1.1 Create `packages/ai` with the same script, tsconfig, ESLint and Vitest conventions as `packages/database`, depending on `@mela/config`, `@mela/database` and `zod`
- [x] 1.2 Add model tier configuration to `packages/config`: the two tiers, their default model identifiers, and per-million-token input/output prices as validated data
- [x] 1.3 Add `GEMINI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `AI_MODEL_DEFAULT`, `AI_MODEL_FAST`, `AI_MAX_OUTPUT_TOKENS`, `AI_TIMEOUT_MS`, `AI_SPEND_CEILING_USD` and `AI_SPEND_WINDOW_HOURS` to the API env schema, with a `.describe()` on each stating its purpose
- [x] 1.4 Add all of them to `.env.example` with placeholders and comments, and confirm the existing completeness test covers the new keys
- [x] 1.5 Verify: `pnpm --filter @mela/config lint typecheck test` passes and a missing API key aborts startup with a message naming the variable

## 2. Invocation audit table

- [x] 2.1 Add the `ai_invocation_outcome` enum and the `ai_invocations` table to the Drizzle schema, with `CHECK` constraints for non-negative token counts and cost
- [x] 2.2 Add the validated write helper recording an invocation, and a `spendInWindow(hours)` read helper
- [x] 2.3 Generate and commit the migration; confirm `pnpm db:check` reports no drift
- [x] 2.4 Add integration tests: an invocation is stored with its accounting, an unrecognised outcome is refused, no credential is stored
- [x] 2.5 Verify: `pnpm --filter @mela/database lint typecheck test` passes with the Compose stack running

## 3. Provider transport

- [ ] 3.1 Define the `AIProvider` interface: a single request method taking rendered messages, a tool definition and a model, returning content plus token usage
- [ ] 3.2 Add the failure classification module mapping provider conditions to retryable and terminal, per design D8
- [ ] 3.3 Implement the Gemini provider (`@google/genai`) and the Cloudflare Workers AI provider (REST via `fetch`), each with the configured timeout, exponential backoff with jitter, and rate-limit retry headers honoured when present
- [ ] 3.4 Add the redaction guard: assert in unit tests that no error raised by the provider contains the API key
- [ ] 3.5 Add a fake provider in `src/testing/` capable of returning valid output, invalid output, a rate limit, an auth failure and a hang
- [ ] 3.6 Verify: unit tests cover every row of the D8 classification table

## 4. Prompt registry

- [ ] 4.1 Add the prompt definition type (name, version, tier, input schema, output schema, `render`) and the frozen registry built at module load
- [ ] 4.2 Add load-time validation: duplicate name+version fails, and a prompt whose rendered output omits its input fails
- [ ] 4.3 Add `render` conventions placing instructions and input in separate blocks with the input delimited and never interpolated into instruction text
- [ ] 4.4 Add one test-only prompt used solely to exercise the machinery, with a schema that includes an explicit "insufficient evidence" outcome
- [ ] 4.5 Add unit tests: unregistered name refused naming the registered ones, unregistered version refused naming the existing versions, injection case confined to the input block
- [ ] 4.6 Verify: `pnpm --filter @mela/ai lint typecheck test` passes

## 5. The service

- [ ] 5.1 Convert a prompt's Zod output schema to JSON Schema and supply it as a single-tool definition
- [ ] 5.2 Add the validation path: parse with Zod, one repair attempt carrying the validation error, then fail naming prompt, version and failing fields
- [ ] 5.3 Add cost estimation from token counts and the configured prices, with a unit test asserting the arithmetic against a known count
- [ ] 5.4 Add spend-ceiling enforcement querying the window before each call, refusing with an error naming the ceiling and the window, and recording the refusal as an invocation outcome
- [ ] 5.5 Wire invocation recording into every path: success, invalid output, provider error, ceiling refusal
- [ ] 5.6 Assemble `AIService` as the package's only public entry point and export it from the package root
- [ ] 5.7 Add unit tests against the fake provider covering every scenario in `specs/ai-provider/spec.md`
- [ ] 5.8 Verify: `pnpm --filter @mela/ai lint typecheck test build` passes

## 6. API wiring

- [ ] 6.1 Add an AI module to `apps/api` providing `AIService` through Nest DI, built from the validated environment
- [ ] 6.2 Confirm no HTTP route exposes the service in this change, and that startup logs name no key
- [ ] 6.3 Verify: `pnpm --filter @mela/api lint typecheck test build` passes and the API still starts with `/health` healthy

## 7. Documentation and final verification

- [ ] 7.1 Document the package in `docs/architecture.md`: the two layers, the prompt versioning rule, and the "validated, never coerced" contract
- [ ] 7.2 Add a short `docs/ai-prompts.md` covering how to add a prompt and why an existing version is never edited
- [ ] 7.3 Update `docs/implementation-progress.md`
- [ ] 7.4 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 7.5 Walk `specs/*/spec.md` scenario by scenario and confirm each has a passing test; list any that do not
- [ ] 7.6 Run `openspec validate add-ai-provider-abstraction --strict` and resolve anything it reports
