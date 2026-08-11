# Add Deployment

**Roadmap coverage:** the deferred halves of the decided stack — `PostgreSQL (local via Docker Compose; AWS RDS later)`, `Redis (local Docker; Upstash/ElastiCache later)`, `Secrets: .env.local` → AWS Secrets Manager, and `CI: no deployment initially`.

## Why

The platform runs on one machine. Every earlier change was explicit that this was temporary and named what would need revisiting: local filesystem artifacts, `.env` for secrets, no authentication until the dashboard existed, no deployment step in the workflow. This change is where those come due.

Deploying also changes the risk profile of things that were previously harmless. A `.env` file on a laptop is a reasonable place for a database password; an environment variable in a deployment definition is not, because it appears in the console, in the API, and in anyone's audit export. Local filesystem artifacts are fine when there is one process and one disk; they are silent data loss when a container restarts.

## What Changes

**Container images**

- Multi-stage builds producing three images — API, worker, web — from the same monorepo, running as a non-root user, with no build toolchain and no source in the final layer.

**Infrastructure as code**

- The database, cache, object storage, container runtime, networking and secrets defined as reviewable code. Nothing created by clicking.
- Managed PostgreSQL and managed Redis, both private, reachable only from the application's network.

**Secrets**

- Secrets held in a managed secret store and read at startup. No secret in an image, in an environment variable in the deployment definition, in the repository, or in any log.

**Artifacts move to object storage**

- Screenshots, captured HTML and audit reports move from the local filesystem to object storage behind a configured driver, so the local development path and the deployed path are the same code with different configuration.

**Migrations run as a deliberate step**

- Migrations run as a separate task before the new version starts serving, never automatically on application boot, and a failure stops the deployment rather than leaving a half-migrated database serving traffic.

**A deployment workflow**

- Extends the existing checks: build images, run migrations, deploy, verify readiness, and roll back on failure. It runs only after every existing check passes.

## Capabilities

### New Capabilities

- `deployment`: Running the platform outside a developer's machine — reproducible images, infrastructure defined as code, secrets from a managed store rather than the environment, artifacts in object storage, migrations as a gated step, and a deployment that verifies readiness and rolls back rather than leaving a broken version serving.

### Modified Capabilities

- `developer-environment`: adds the deployment workflow to what the workflow does, while keeping every existing check gating it.
- `website-analysis-pipeline`: changes artifact storage from a local path to a configured driver, keeping the local driver as the development default.

## Impact

- New `Dockerfile` per application and infrastructure definitions in the repository.
- New deployment workflow, gated behind the existing checks.
- Artifact storage abstraction in `apps/api` with two drivers.
- New environment variables for the storage driver and the secret store.
- Depends on `add-authentication` and `add-observability` — deploying an unauthenticated application with no readiness endpoint is not something this change should make possible.

## Non-goals

Deferred:

- **Multi-region, autoscaling and high availability.** One region, one instance of each service, a managed database with automated backups. Availability engineering before there are users is cost without benefit.
- **Blue-green and canary deployment.** Deploy, verify readiness, roll back on failure.
- **A staging environment.** One deployed environment; adding a second is a configuration change once the first exists.
- **Cost dashboards and budget alarms.** The model spend ceiling already bounds the largest variable cost.
- **CDN and custom domains** — the operator-facing application does not need either.
- **Database read replicas or connection pooling infrastructure.** The application already pools.
