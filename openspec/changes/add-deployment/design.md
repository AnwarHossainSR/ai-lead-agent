# Design — Add Deployment

## Context

Several earlier changes deferred something explicitly to this one, and this is where each comes due:

- **Bootstrap** — "no deployment initially"; `.env` for secrets; local filesystem for files.
- **Website analysis** — "not object storage; the stack says local filesystem. `add-deployment` revisits it."
- **Dashboard** — the local-only, unauthenticated posture, closed by `add-authentication`.
- **Observability** — "choosing a log destination belongs with `add-deployment`."

The platform is two Node processes, PostgreSQL, Redis and a browser. That is a small deployment, and most of the work is refusing to make it bigger than it is.

One property changes character on deployment. A database password in a `.env` file on a laptop is reasonable. The same value as an environment variable in a deployment definition is not — it is visible in the console, readable through the provider API, and present in anyone's audit export. That is why secrets move to a store rather than being copied across.

## Goals / Non-Goals

**Goals:**

- Run the platform reproducibly outside one machine.
- No secret in an image, a definition, a repository or a log.
- Artifacts that survive a container restart.
- A deployment that verifies before it commits and rolls back when it cannot.

**Non-Goals:** multi-region; autoscaling; blue-green or canary; a staging environment; CDN and custom domains; read replicas; cost dashboards.

## Decisions

### D1 — Three images from one monorepo, multi-stage

`Dockerfile.api`, `Dockerfile.worker`, `Dockerfile.web` at the repository root, sharing a base stage that installs with a frozen lockfile and builds once.

Final stages contain the built output, production dependencies pruned by `pnpm deploy --filter`, and nothing else — no source, no compiler, no package manager cache. Each runs as a non-root user.

**The worker image is the awkward one:** it needs a browser. It uses Playwright's own base image at the pinned version rather than installing Chromium by hand, because keeping a hand-rolled browser install in step with a pinned Playwright version is a recurring source of the failure where the browser is subtly wrong and every analysis silently degrades.

**The API image does not carry a browser**, so it stays small. This is the change where the API and the worker stop being the same image, which is fine — they were only ever the same process for convenience.

### D2 — Managed database and cache, private, encrypted

Managed PostgreSQL and managed Redis, both on a private network with no public address, both requiring TLS, with automated backups and a defined retention on the database.

**Why managed rather than containers:** backups, patching and failover for a database holding the only copy of everything the platform has learned. Running PostgreSQL in a container to save money is a decision people regret exactly once.

`postgres` and `ioredis` both take TLS through the connection string, so this is a configuration change rather than a code one.

### D3 — Secrets from a store, read once at startup

`DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `SESSION_SECRET`, the places API key and the error reporting DSN live in a managed secret store. The deployment definition holds **references**, not values.

Startup fetches them and merges into the validated environment before `loadApiEnv()` runs — the existing loader is unchanged, and the existing behaviour of aborting with a message naming a missing variable still applies. `hydrateEnvironment` already establishes that already-set values win, so the local `.env` path and the store path do not fight.

**Rotation does not rebuild anything:** restart the processes and they read the new value.

**Build logs:** the build stage receives no secret, so there is nothing to leak. The one temptation — passing a token to install a private dependency — does not arise, because there are none.

### D4 — Artifacts behind a driver, decided now rather than at the boundary

```ts
interface ArtifactStore {
  put(key: string, body: Buffer | Readable, contentType: string): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(keys: readonly string[]): Promise<void>;
}
```

Two implementations: `local` (development default, the current behaviour) and `s3` (object storage). `website_analysis` stores a **key**, not a path — which is why the earlier change's write helper already rejects absolute paths and paths escaping the root. That constraint was written for this.

**A container filesystem is not storage.** A deployed process writing a screenshot to its own disk loses it on the next deploy, and nothing would notice until an operator clicked a broken image months later.

**A store that cannot be written to fails the analysis.** The alternative — record the analysis as completed with a missing artifact — is the fabrication pattern this project has refused everywhere else.

### D5 — Migrations as a task, never on boot

A one-off task running `db:migrate` against the new image, executed before the new version starts serving. A failure stops the deployment; the previous version keeps serving the old schema, which it was built for.

**Why not on application boot:** with two processes, boot-time migration means two racing migrators. With a rollout, it means the new schema arrives while the old version is still serving. Both are how a migration ends up half-applied against live traffic.

This also means **migrations must be backward-compatible with the currently deployed version** for the duration of a deploy. Recorded here because it is a constraint on every future migration, not just this change: additive first, remove in a later deployment once nothing reads the column.

### D6 — Deploy, verify readiness, roll back

```
checks (existing) ─▶ build images ─▶ push ─▶ migrate ─▶ deploy ─▶ wait for /ready ─▶ done
                                                │                       │
                                                └── fail: stop ─────────┴── timeout: roll back
```

`/ready` from `add-observability` is what makes this possible — it answers "can this version actually serve", which a liveness check or an HTTP 200 on `/` does not. Bounded wait; on timeout the previous version is restored and the workflow reports a failing status naming the reason.

**A rollback is a failed run, not a quiet recovery.** A pipeline that rolls back and reports green trains everyone to ignore it.

**Only from the default branch, only after every check.** A pull request never deploys.

### D7 — Short-lived deployment credentials

The workflow authenticates via OIDC federation to a role scoped to exactly the deployment actions — push to the image registry, run the migration task, update the services, read the deployment status. No long-lived access key in repository settings.

**Why this is worth the setup cost:** a long-lived key in CI settings is the single most commonly exfiltrated cloud credential, and it cannot be rotated without someone remembering to.

### D8 — Testing what can be tested

Deployment resists unit testing, so the coverage is placed where it is real:

- **Image tests:** build each image in CI and assert the user is not root, no source directory is present, no environment file is present, and the entry point starts and reports ready against a local stack.
- **A secret-scan step** over the built image layers and the build logs for the sentinel values.
- **Artifact driver tests:** the same analysis suite run against both drivers, plus the unwritable-store case failing the analysis.
- **Migration gating:** a test asserting an application process does not apply pending migrations on boot.
- **Infrastructure:** the plan step runs on every pull request touching the definitions, so a destructive change is visible in review before anyone applies it.

A first real deployment is a manual verification recorded in the task list, because there is no honest way to unit-test "it came up".

## Risks / Trade-offs

- **A managed database and cache cost money while there are no users** → the smallest instance classes, one region, one instance; this is the cost of not running the only copy of the data in a container.
- **The worker image is large because of the browser** → using Playwright's own pinned base image trades size for a browser that matches the library; a hand-rolled install trades a smaller image for silent drift.
- **Backward-compatible migrations are a discipline, not a mechanism** → stated explicitly in D5 so it lands in the documentation and in the review of every future migration.
- **A rollback restores code but not schema** → which is exactly why migrations must be additive; a migration that cannot be rolled back is a decision to be made deliberately, in its own change.
- **One environment means the first real test is production** → accepted for a single-operator tool, and the readiness gate plus rollback is what makes it tolerable. A staging environment becomes a configuration change once this exists.
- **OIDC federation is more setup than an access key** → one-time cost against a credential that cannot be exfiltrated because it does not exist between runs.
