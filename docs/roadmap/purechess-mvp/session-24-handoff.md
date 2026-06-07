# Session 24 Handoff — Deployment & Infrastructure

## What Was Built

### API changes

**New files:**
- `apps/api/src/redis/redis.module.ts` — `@Global()` `RedisModule` that provides and exports `REDIS_CLIENT` (ioredis) using `ConfigService` to read `REDIS_URL`. Mirrors the pattern in `admin.module.ts`.
- `apps/api/Dockerfile` — Multi-stage build: `deps` stage installs with `pnpm install --frozen-lockfile`, `builder` runs `prisma generate` + `pnpm build`, `runner` is slim `node:20.15.1-alpine` running `dist/main.js`. pnpm pinned to `9.4.0` via corepack.
- `apps/api/fly.toml` — Fly app `purechess-api`, region `iad`, shared-cpu-1x / 1GB RAM, autostop enabled, `min_machines_running=1`, health check on `GET /api/health`.
- `apps/api/test/health/health.spec.ts` — 6 unit tests covering controller (200/503) and service (ok/db-error/redis-error) paths.

**Modified files:**
- `apps/api/src/app.service.ts` — Injects `PrismaService` and `REDIS_CLIENT`. `getHealth()` now returns `{ status, db, redis, uptime }` via parallel `Promise.all`. Uses `$queryRaw\`SELECT 1\`` for DB probe, `redis.ping()` for Redis probe.
- `apps/api/src/app.controller.ts` — `getHealth()` is now async, receives `@Res() res: Response`, returns HTTP 200 if `status === 'ok'` else 503.
- `apps/api/src/app.module.ts` — Added `RedisModule` import (global, so `REDIS_CLIENT` is available everywhere).
- `apps/api/src/config/env.config.ts` — Added `WEB_URL` to both `EnvConfig` interface and Joi schema (optional, default `http://localhost:3000`).
- `apps/api/src/main.ts` — CORS allowed origins now includes `process.env['WEB_URL']`.

### Web changes

**New files:**
- `apps/web/src/app/api/health/route.ts` — `GET /api/health` Next.js route returning `{ status: 'ok' }` with 200.
- `apps/web/Dockerfile` — Multi-stage build producing Next.js standalone output. `runner` copies `.next/standalone`, `.next/static`, and `public`; CMD is `node apps/web/server.js`.
- `apps/web/fly.toml` — Fly app `purechess-web`, region `iad`, same shape as API, health check on port 3000.

**Modified files:**
- `apps/web/next.config.js` — Added `output: 'standalone'` and `async headers()` block with full security headers: CSP (allowlists Sentry, PostHog, Google, Apple OAuth, Fly staging), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

### Infrastructure

**New files:**
- `.dockerignore` — Excludes `node_modules`, `.next`, `dist`, `coverage`, `.env*`, `.git`, `.epic-worktrees`, `*.log`.
- `docker-compose.yml` — Dev services: `postgres:16-alpine`, `redis:7-alpine`, `api`, `web`. Healthchecks on postgres and redis gate API startup. API gates web startup.
- `.github/workflows/ci.yml` — Jobs: `lint-typecheck`, `test`, `build` (Docker buildx, GitHub cache), `smoke` (runs on push to main — starts API with real Postgres/Redis, asserts `/api/health` returns `ok`).
- `.github/workflows/deploy.yml` — Jobs: `migrate` (one-off Fly Machine), `deploy-api`, `deploy-web` (both via `flyctl deploy --remote-only --strategy rolling`), `verify` (health check both apps). All jobs use GitHub Environment `prod` requiring manual approval.
- `infra/env.example.ts` — TS constant `ENV_SCHEMA` documenting every env var with `type`, `required`, `description`, `example`. Exports `REQUIRED_KEYS` for CI validation.
- `infra/RUNBOOK.md` — Full operational runbook: deploy, rollback, secrets, DB access, migrations, backup/restore, Redis, logs, health checks, scaling, Cloudflare, incident response.
- `scripts/db-backup.sh` — `pg_dump --format=custom` → gzip → upload to Cloudflare R2 via `aws s3 cp` (S3-compatible endpoint). Prunes backups older than the latest 30.

**Modified files:**
- `.env.example` — Added `WEB_URL`, `FLY_API_TOKEN`, `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, and Upstash Redis TLS comment.
- `package.json` — Added scripts: `infra:up`, `infra:down`, `infra:reset`, `db:migrate:deploy`.

## Verification Evidence

```
# Health tests — 6/6 pass
pnpm --filter @purechess/api test --testPathPattern="test/health"
→ Test Suites: 1 passed; Tests: 6 passed

# Web tests — all pass (no regressions)
pnpm --filter @purechess/web test
→ Test Files: 15 passed; Tests: 108 passed

# Typecheck — no new errors in session 24 files
pnpm --filter @purechess/api typecheck
→ Zero errors in src/app.controller.ts, src/app.service.ts, src/redis/redis.module.ts, src/app.module.ts
→ Pre-existing errors: @purechess/shared unlinked, @prisma/client not generated (same as session 23)

pnpm --filter @purechess/web typecheck
→ No new errors from session 24 code
→ Pre-existing errors: @purechess/shared unlinked (same as session 23)

# Lint — no new errors in session 24 files
→ Pre-existing: eslint not installed globally (api, shared)
→ Pre-existing: unescaped entity in apps/web/src/app/admin/reports/[id]/page.tsx (prior session)
```

## Open Issues / Known Gaps

- **Fly apps not provisioned**: `purechess-api` and `purechess-web` Fly apps must be created before deploy (`flyctl apps create purechess-api`, `flyctl apps create purechess-web`). Documented in RUNBOOK.md.
- **GitHub Environment `prod` not created**: Must be created in repo Settings → Environments with required reviewers before `deploy.yml` works.
- **Cloudflare DNS/WAF**: Documented in RUNBOOK.md but not automated. DNS records and WAF rules must be configured manually in Cloudflare dashboard.
- **Neon DB provisioned externally**: `DATABASE_URL` must point to a real Neon project. Pooler URL (`?pgbouncer=true`) for app, direct URL for migrations.
- **Upstash Redis provisioned externally**: `REDIS_URL=rediss://...` (TLS) must be set as a Fly secret.
- **`db-backup.sh` cron**: No automated scheduler set up. Must be wired via Fly Machines cron or an external cron service. Command: `flyctl machine run --app purechess-api --rm -- sh -c "./scripts/db-backup.sh"`.
- **Source maps in CI**: `scripts/upload-sourcemaps.sh` is called in CI if `SENTRY_AUTH_TOKEN` secret is set. If absent, upload is skipped (gracefully fails).
- **`unsafe-inline` in CSP**: Required for Next.js inline scripts. Tightening with nonces is a post-MVP task.
- **WebSocket on Fly**: Fly Anycast proxies WS correctly when the app responds to `fly-replay` headers. The session 06 gateway handles this — no changes needed in session 24.

## Outputs Downstream Sessions Can Rely On

| Symbol / Path | Consumer |
|---|---|
| `GET /api/health` → `{ status, db, redis, uptime }`, 200/503 | Session 25 QA, Fly health checks |
| `GET /api/health` (web, port 3000) → `{ status: 'ok' }` | Fly health checks for `purechess-web` |
| `apps/api/Dockerfile` | CI build, Fly deploy |
| `apps/web/Dockerfile` | CI build, Fly deploy |
| `apps/api/fly.toml` | `flyctl deploy --app purechess-api` |
| `apps/web/fly.toml` | `flyctl deploy --app purechess-web` |
| `.github/workflows/ci.yml` | PR checks |
| `.github/workflows/deploy.yml` | `push main` → prod deploy with approval gate |
| `infra/RUNBOOK.md` | Ops team, on-call |
| `infra/env.example.ts` | CI env validation, onboarding |
| `scripts/db-backup.sh` | Backup cron |
| `pnpm infra:up` / `infra:down` / `infra:reset` | Local dev |
| `pnpm db:migrate:deploy` | Migration job in deploy pipeline |
| `REDIS_CLIENT` injection token (global via `RedisModule`) | Any NestJS service needing Redis directly |
| CSP in `next.config.js` | Security headers on all web responses |
