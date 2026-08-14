# Tasks — Add Deployment

Work one task at a time. After each task: run the relevant checks, report what changed, and stop for approval before starting the next. Each task is one conventional commit.

## 1. Artifact storage driver

- [ ] 1.1 Define the `ArtifactStore` interface with put, get and delete, keyed rather than path-based
- [ ] 1.2 Implement the local filesystem driver preserving the current behaviour, and make it the development default
- [ ] 1.3 Change website analysis to write and read through the driver, storing a key rather than a path
- [ ] 1.4 Make a store failure record the analysis as failed with that reason rather than as completed
- [ ] 1.5 Add `ARTIFACT_STORE_DRIVER` and the object storage settings to the API env schema and `.env.example`
- [ ] 1.6 Walk every scenario in `specs/website-analysis-pipeline/spec.md` by hand against the local driver and record the outcome
- [ ] 1.7 Verify: `pnpm --filter @mela/api lint typecheck` passes with the Compose stack running

## 2. Object storage driver

- [ ] 2.1 Implement the object storage driver behind the same interface
- [ ] 2.2 Repeat the 1.6 walkthrough against it using a local object storage emulator in Compose
- [ ] 2.3 Confirm no application code changes between drivers
- [ ] 2.4 Verify: `pnpm --filter @mela/api lint typecheck` passes against both drivers

## 3. Container images

- [ ] 3.1 Add `Dockerfile.api` as a multi-stage build with a frozen-lockfile install, production dependencies pruned, no source in the final layer, and a non-root user
- [ ] 3.2 Add `Dockerfile.worker` on the pinned Playwright base image, with the same properties
- [ ] 3.3 Add `Dockerfile.web` for the Next.js standalone output, with the same properties
- [ ] 3.4 Add `.dockerignore` excluding `.env`, artifacts, `node_modules` and build output
- [ ] 3.5 Inspect each built image and confirm the user is not root, no source or environment file is present, and no build toolchain remains
- [ ] 3.6 Start each image against the local stack and confirm it reports ready
- [ ] 3.7 Verify: all three images build from a clean clone and start

## 4. Secrets

- [ ] 4.1 Add the secret loader fetching from the managed store and merging into the environment before validation, leaving already-set values untouched
- [ ] 4.2 Confirm a missing secret aborts startup with the existing message naming the variable, and exits non-zero
- [ ] 4.3 Confirm the local `.env` path is unchanged when no store is configured
- [ ] 4.4 Add a secret-scan step over built image layers and build logs for sentinel values
- [ ] 4.5 Verify: rotating a secret in the store and restarting picks up the new value with no rebuild

## 5. Infrastructure as code

- [ ] 5.1 Define the network, the private subnets and the security groups
- [ ] 5.2 Define the managed PostgreSQL instance: private, TLS required, automated backups with a defined retention
- [ ] 5.3 Define the managed Redis instance: private, TLS required
- [ ] 5.4 Define the object storage bucket, private, with no public access
- [ ] 5.5 Define the container runtime services for the API, the worker and the web application, and the migration task definition
- [ ] 5.6 Define the secret store entries and the deployment role scoped to the deployment actions only
- [ ] 5.7 Add the plan step to the pull request workflow so infrastructure changes are visible in review
- [ ] 5.8 Verify: connections to the database and the cache from outside the application network fail

## 6. Migrations as a gated step

- [ ] 6.1 Add the one-off migration task running `db:migrate` against the new image
- [ ] 6.2 Confirm by hand that an application process with a pending migration boots without applying it
- [ ] 6.3 Make a migration failure stop the deployment with the previous version still serving
- [ ] 6.4 Document the backward-compatibility rule for migrations during a rollout
- [ ] 6.5 Verify: a deliberately failing migration stops the deployment and leaves the previous version serving

## 7. Deployment workflow

- [ ] 7.1 Extend the workflow: build and push images only on the default branch and only after every check has passed
- [ ] 7.2 Authenticate with short-lived federated credentials, with no long-lived key in repository settings
- [ ] 7.3 Run the migration task, then deploy, then wait for `/ready` within a bounded time
- [ ] 7.4 Roll back to the previous version on readiness timeout and report a failing status naming the reason
- [ ] 7.5 Confirm a pull request run deploys nothing
- [ ] 7.6 Verify: a deliberately broken build fails before any deployment step runs

## 8. First deployment and verification

- [ ] 8.1 Apply the infrastructure and record what was created
- [ ] 8.2 Deploy, run migrations, and confirm `/ready` reports ready for the API and the worker
- [ ] 8.3 Sign in to the deployed web application and confirm the workspace views render
- [ ] 8.4 Run one company through the pipeline end to end and confirm artifacts land in object storage and survive a redeploy
- [ ] 8.5 Confirm no credential appears in the deployment definition, the image layers, the build logs or the application output
- [ ] 8.6 Exercise a rollback deliberately and confirm the previous version is restored and the run reports failure

## 9. Documentation and final verification

- [ ] 9.1 Write `docs/deployment.md`: resources created, where secrets live, how migrations run, how to deploy and how to roll back
- [ ] 9.2 Document the migration backward-compatibility rule in `docs/development.md`
- [ ] 9.3 Confirm the local setup path still works with no deployment credentials and no cloud access
- [ ] 9.4 Update `docs/architecture.md` and `docs/implementation-progress.md`
- [ ] 9.5 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` at the root and record the real output
- [ ] 9.6 Walk `specs/*/spec.md` scenario by scenario and record a manual verification for each; list any that could not be verified
- [ ] 9.7 Run `openspec validate add-deployment --strict` and resolve anything it reports
