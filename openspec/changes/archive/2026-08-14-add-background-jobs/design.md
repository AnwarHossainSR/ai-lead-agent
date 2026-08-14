# Design — Add Background Jobs

## Context

The bootstrap design recorded, as the reason the API is a separate NestJS application rather than Next.js route handlers, that "the worker process will run the same services inside BullMQ workers; Nest modules and providers are reusable in a worker process". This change is that claim being cashed. If it were wrong, it would be wrong now.

Redis has been in Compose and in the health check since the first change, deliberately, so that the connection string was proven before a worker depended on it. `ioredis` is already pinned to the 5.x line for exactly this reason.

Every service this change schedules is already written, already tested, and already bounded — each stage has its own timeouts, politeness limits and staleness query. The queue does not add capability; it removes the requirement that a person hold a browser tab open while a browser runs.

## Goals / Non-Goals

**Goals:**

- Get long work off the request path without rewriting any service.
- Retry what is worth retrying and nothing else.
- Never do the same expensive work twice.
- Make the queue's real state — especially its failures — visible.

**Non-Goals — refused:**

- Any job that sends an outreach message, or approves one.

**Deferred:** distributed scheduling; a queue UI; score-based job priority; automatic dead-letter replay.

## Decisions

### D1 — One worker process, `createApplicationContext`, existing modules unchanged

`apps/api/src/worker.ts` boots the same `AppModule` through `NestFactory.createApplicationContext` — no HTTP server, same providers, same database pool, same `AIService`.

**Why not a separate application:** the services carry their DI wiring, their configuration and their tests. A second app would duplicate all three and the copies would drift.

`pnpm dev` becomes three processes. Turbo already runs persistent tasks in parallel.

### D2 — A queue per stage, because the stages are operationally unlike

| Queue | Concurrency | Attempts | Timeout | Bounded by |
|---|---|---|---|---|
| `discovery` | 1 | 2 | 15 min | source rate limits |
| `verification` | 4 | 3 | 2 min | per-host interval |
| `website-analysis` | 2 | 2 | 5 min | browser memory |
| `technology-detection` | 8 | 2 | 1 min | CPU only — no I/O |
| `opportunity-analysis` | 2 | 3 | 3 min | model spend ceiling |
| `contact-research` | 3 | 3 | 3 min | per-host interval |
| `scoring` | 8 | 2 | 1 min | database only |
| `research-summary` | 2 | 3 | 3 min | model spend ceiling |
| `reply-classification` | 4 | 3 | 2 min | model spend ceiling |

Website analysis at concurrency 2 because each job is a browser context; technology detection at 8 because it is regular expressions over stored data. A single shared limit would be wrong for both.

All values are configuration, validated at load with a positive-concurrency check.

### D3 — Payloads validated on both sides of Redis

A queue is a trust boundary. A payload is serialized JSON that may have been enqueued days ago by a different deployment.

- **On enqueue:** parse with the job's Zod schema; a failure refuses the enqueue.
- **On process:** parse again; a failure fails the job **without retrying**, because a payload that is structurally wrong will be equally wrong on the third attempt.

This is the same "validate at every trust boundary" rule the stack already applies to API input, provider responses and AI output.

### D4 — Deterministic job ids give idempotency for free

`jobId = \`${type}:${subjectId}\`` — BullMQ refuses a duplicate id while a job is waiting or active. Enqueueing "analyse company X" ten times while it is queued yields one job. After completion the id is free again, so a later re-run is permitted.

**Second layer:** each handler checks currency before doing work. A job for a company whose analysis is already current completes as `skipped` with that reason — no browser launched, no model called. This matters because chained enqueues and scheduled maintenance can legitimately both target the same subject.

`{ force: true }` in the payload bypasses the currency check for a deliberate re-run.

### D5 — Chaining, and where the chain stops

```
discovery ─▶ verification ─▶ website-analysis ─▶ technology-detection
                                                        │
                     contact-research ◀──────────────────┤
                                    │                    ▼
                                    └──────────▶ opportunity-analysis
                                                         │
                                                      scoring
                                                         │
                                                 research-summary
                                                         │
                                                      [ STOP ]
```

Drafting is **not** chained. A draft is a message about to be shown to a person and eventually sent to a real company, and generating them automatically across a whole portfolio would mean a spend and a backlog nobody asked for. An operator drafts for a lead they have chosen.

Nothing after drafting exists to chain to, because nothing sends. A test asserts no registered job type transmits and no scheduled job approves.

### D6 — Scheduled maintenance from the staleness queries

Every pipeline change deliberately provided a staleness query and deliberately did not run it. This is where they run, as BullMQ repeatable jobs:

| Schedule | Enqueues | Default |
|---|---|---|
| re-verify | companies past the verification staleness window | daily |
| re-analyse | companies past the analysis staleness window | weekly |
| rescore | leads on an older weight version | hourly |
| no-response | messages sent longer ago than the configured interval | daily |
| prune artifacts | analysis artifacts older than the retention window | weekly |

Each bounded by `maxPerRun` so a first run against a large portfolio enqueues a bounded batch rather than a hundred thousand jobs. Each individually disableable.

Repeatable jobs use a fixed key per schedule so a worker restart re-registers rather than duplicating.

### D7 — Failure visibility, which is the actual product of a queue

Failed jobs are retained (`removeOnFail: false`, capped) with type, subject, attempts and final reason. `GET /api/queues` returns per-queue counts; `GET /api/queues/:name/failed` lists them; `POST /api/queues/:name/failed/:id/retry` re-enqueues one.

The Terminus health check gains a queue indicator, alongside the existing Postgres and Redis checks and bounded by the same 2-second timeout.

**Completed jobs are removed** on a count and age cap. A queue whose completed set grows forever is a memory leak with a schedule.

### D8 — Testing

- **Integration, real Redis:** deterministic-id deduplication; retry classification for transient, blocked and validation failures; timeout ending a job; a job exhausting attempts retained with its reason; explicit retry; scheduled job registration and the per-run bound; graceful shutdown releasing an active job.
- **Unit:** payload schemas both directions, including a payload missing a field a later schema requires; currency-skip logic per stage; queue configuration load validation.
- **The absence test:** no registered job type transmits an outreach message, and no scheduled or chained job approves one.
- Tests use a dedicated Redis database index and flush it between files, mirroring how the database harness uses a dedicated `_test` database.

## Risks / Trade-offs

- **A third process in development** → started by the same command and reported at startup; the alternative is a browser job wedging an HTTP request.
- **Redis becomes load-bearing rather than decorative** → it has been health-checked from the first change precisely so this transition would not be the moment a wrong connection string was discovered.
- **Chained failures cascade quietly** → each stage's failure is retained with its reason, and the chain simply stops; a company that never reaches scoring is visible through the same staleness queries that drive maintenance.
- **Scheduled maintenance could stampede a first run** → `maxPerRun` on every schedule, and per-queue concurrency below that.
- **Deterministic ids can suppress a legitimate re-run** → only while the earlier job is waiting or active; `force` exists for the deliberate case.
- **Pressure to chain drafting "just for high-priority leads"** → that is a spend and a queue of messages nobody asked for; it would need its own decision, not a config default.
