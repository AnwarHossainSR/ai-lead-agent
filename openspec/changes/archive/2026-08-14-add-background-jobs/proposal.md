# Add Background Jobs

**Roadmap coverage:** the BullMQ-on-Redis line of the decided stack. Moves the pipeline stages built so far off the request path.

## Why

Every pipeline stage currently runs inside an HTTP request. Discovery holds a connection open for minutes; website analysis launches a browser and waits; opportunity analysis and drafting each block on a model call. That works for one operator clicking one button and fails at every other scale: a browser crash takes down a request, a rate limit means a 504, and nothing can be retried without a human clicking again.

Redis has been running since the first change and is checked by the health endpoint for exactly this reason — so that when the queue arrived, the connection string was already known to be correct rather than being discovered wrong with a worker on top of it.

This change also makes the pipeline a *pipeline*: a company that finishes verification can proceed to analysis without anybody deciding to make it happen.

## What Changes

**A worker process**

- A second entry point in `apps/api` started with `NestFactory.createApplicationContext`, reusing the existing Nest modules unchanged. The API was built as a separate application from the web app precisely so this would be possible without rewriting the services.

**Queues, one per stage**

- Discovery, verification, website analysis, technology detection, opportunity analysis, contact research, scoring, summary generation and reply classification each get a queue with its own concurrency, retry policy and rate limit — because a browser job and a model call have nothing in common operationally.

**Job payloads are validated**

- Every payload is parsed with Zod on the way in and on the way out of Redis. A queue is a trust boundary: payloads are serialized, may be minutes or days old, and may have been enqueued by a previous version of the code.

**Idempotency and no duplicate work**

- Jobs carry deterministic identifiers so enqueueing the same work twice is one job. A stage that already produced a current result for a company is skipped rather than repeated.

**Pipeline chaining, with the human gate intact**

- Completing a stage may enqueue the next. The chain stops at outreach drafting. **Nothing enqueues a send, because there is nothing that sends** — the chain ends with a draft awaiting a person.

**Scheduled maintenance**

- Repeatable jobs for the staleness queries the earlier changes provided: re-verify stale companies, re-analyse stale websites, rescore leads on an old weight version, mark messages with no response after the configured interval, and prune old artifacts.

**Observability of the queue itself**

- Endpoints reporting queue depth, active, completed, failed and delayed counts, and the failed jobs with their reasons. The health endpoint gains a queue check.

## Capabilities

### New Capabilities

- `background-jobs`: Running the pipeline's stages as retryable, rate-limited, idempotent background work with validated payloads, chaining stages automatically up to but never past the human approval gate, and reporting the queue's real state including what failed and why.

### Modified Capabilities

- `developer-environment`: adds the worker process to the development command and the container definition, worker environment variables, and the queue health check.

## Impact

- New worker entry point and queue modules in `apps/api`; existing services unchanged.
- New dependency `bullmq`; `ioredis` is already present and already pinned to the 5.x line BullMQ is built against.
- `pnpm dev` starts three processes instead of two.
- No new migration — job state lives in Redis.
- Depends on every pipeline change from `add-company-discovery` through `add-outreach-tracking`.

## Non-goals

Refused:

- **A queue that sends outreach.** There is no send to enqueue. The chain terminates at a draft awaiting human approval, and no job type exists that could transmit.
- **Automatic approval of anything.**

Deferred:

- **A distributed scheduler or multi-node coordination** — one worker process, scaled by concurrency, is right for a single-operator tool.
- **A queue dashboard UI** — `add-dashboard` renders the counts this change exposes.
- **Priority queues by lead score** — worth doing once there is a backlog worth prioritising.
- **Dead-letter replay automation** — failed jobs are listed with their reasons and retried explicitly.
