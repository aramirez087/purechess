---
depends_on: [23]
touches:
  - ".github/workflows/**"
  - "Dockerfile"
  - "apps/api/Dockerfile"
  - "apps/web/Dockerfile"
  - "fly.toml"
  - "apps/api/fly.toml"
  - "apps/web/fly.toml"
  - "infra/**"
  - "infra/cloudflare/**"
  - "scripts/deploy.sh"
  - "scripts/db-backup.sh"
  - ".dockerignore"
  - "docker-compose.yml"
  - ".github/CODEOWNERS"
parallel_safe: false
model: sonnet
cli: opencode
---

# Session 24: Deployment & Infrastructure

## Mission

Make Purchess deployable to production. This session sets up Dockerfiles, Fly.io / Railway configs, Cloudflare as the front door, environment management, CI pipelines, and the operational runbook (backups, deploys, rollbacks). The MVP must be launchable from a single command and roll back in under 5 minutes.

## Tasks

1. **Containerization**:
   - Root `Dockerfile` (multi-stage) that builds `apps/web` and `apps/api` into separate final images.
   - `apps/web/Dockerfile` — Next.js standalone output. `pnpm build` produces `apps/web/.next/standalone`; copy that into a slim `node:20-alpine` image. Health check: `GET /api/health` (Next.js route that calls the API health endpoint or just returns 200).
   - `apps/api/Dockerfile` — NestJS build. `pnpm build` → `dist/`. Run with `node dist/main.js`. Health check: `GET /health`.
   - `.dockerignore` at root excluding `node_modules`, `.next`, `.git`, `.epic-worktrees`, `dist`, `coverage`, `.env*`.
2. **docker-compose.yml (dev)**:
   - Services: `postgres`, `redis`, `api`, `web`. Wires env, exposes ports, mounts source for live reload.
   - `pnpm infra:up` brings it up; `pnpm infra:down` tears down; `pnpm infra:reset` drops volumes.
3. **Fly.io configs**:
   - `apps/api/fly.toml` — one region (e.g., `iad`), 1 shared CPU / 1GB RAM to start, autoscale to 2 instances. Internal port 4000, no public port (only via Cloudflare).
   - `apps/web/fly.toml` — similar shape, internal port 3000. Standalone Next.js runs as a long-lived Node process.
   - `fly.toml` aggregator: optional multi-process app config. For MVP, two separate apps is simpler.
   - `fly secrets` documented: `SESSION_SECRET`, `DATABASE_URL`, `REDIS_URL`, `SENTRY_DSN`, `POSTHOG_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `WEB_URL`.
4. **Cloudflare**:
   - DNS for `purchess.com` and `*.purchess.com` proxied through Cloudflare.
   - SSL: Full (strict). Origin cert at Fly.
   - WAF: Cloudflare Managed Rules + a rate-limit rule on `/api/auth/*` and `/realtime` upgrade requests.
   - Caching: `Cache Level: Standard`, Browser Integrity Check on, Bypass cache on `/api/*` and `/realtime`.
   - Page Rules / Cache Rules: cache `/`, `/_next/static/*`, public profiles (60s), public game reviews (60s).
5. **Postgres** (Neon or Supabase):
   - Provisioned DB. `DATABASE_URL` includes `?sslmode=require` and `?pgbouncer=true` if using a pooler.
   - `scripts/db-backup.sh` runs `pg_dump` to a remote object store (S3 / R2) daily. Cron via Fly Machine or external scheduler.
6. **Redis** (Upstash):
   - Provisioned with TLS. `REDIS_URL=rediss://...`.
   - Sessions: not stored in Redis (per Session 04 — Postgres only). Only queues, active games, presence.
7. **CI** (`.github/workflows/ci.yml`):
   - On PR: install, lint, typecheck, unit tests, build, e2e (smoke).
   - On merge to main: same, plus deploy preview to Fly.
   - Concurrency: cancel in-progress runs on the same PR.
8. **CD** (`.github/workflows/deploy.yml`):
   - On main: build images, push to Fly registry, run `flyctl deploy`.
   - Manual approval gate before promoting to prod (use a GitHub Environment called `prod` with required reviewers).
9. **Migrations**:
   - `pnpm db:migrate:deploy` is the only command that runs migrations in prod. Run from a one-off Fly Machine, not from the API container startup.
   - Migrations are forward-only. No down migrations in MVP.
10. **Health and readiness**:
    - API: `GET /health` returns `{ status: 'ok', db: 'ok' | 'error', redis: 'ok' | 'error', uptime }`. 200 if all ok, 503 if any dependency fails.
    - Web: `GET /api/health` returns 200.
    - Fly health checks use these endpoints.
11. **Env management**:
    - All env vars documented in `infra/env.example.ts` (a TS file that exports the schema for runtime validation).
    - CI fails if any required var is missing.
    - Local: `.env` is gitignored; `.env.example` is the source of truth.
12. **Operational runbook** (`infra/RUNBOOK.md`):
    - Deploy: `gh workflow run deploy.yml` or push to main.
    - Rollback: `flyctl releases rollback`.
    - DB access: `flyctl postgres connect -a purchess-db`.
    - Redis access: `flyctl redis connect -a purchess-redis`.
    - Logs: `flyctl logs -a purchess-api`.
    - Backup restore: documented procedure.
13. **Security headers**:
    - `Content-Security-Policy` defined in `next.config.js`. Strict, with allowlisted sources for Sentry, PostHog, and the API.
    - `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying everything not used.
14. **Tests**:
    - CI config validates: image builds, app boots, health endpoint returns 200 in the container.
    - Smoke test: deploy to a staging app, run Playwright against it, assert core flows.
15. **Verification**:
    - `flyctl deploy` from a clean checkout succeeds.
    - `curl https://purchess.com/api/health` returns 200.
    - Rollback test on staging.

## Deliverables

- Two production apps on Fly (`purchess-api`, `purchess-web`).
- Cloudflare in front with WAF, caching, and SSL.
- CI + CD wired.
- Operational runbook.

## Notes for Downstream Sessions

- Session 25 (QA + docs) writes the release checklist that exercises the deploy pipeline.
- Secrets are set via `flyctl secrets set`. Never commit them.
- The Dockerfile must be reproducible — pin Node to 20.x and pnpm to a specific version.
- For high-availability WebSocket: Fly's Anycast proxies WS as long as the app responds to `fly-replay` headers. The Sessions 06 gateway should handle that. Test it.

## Out of scope (defer)

- Multi-region active/active deployment.
- Read replicas.
- Custom Grafana dashboards.
- Cost optimization beyond the obvious (e.g., tier down on idle).
