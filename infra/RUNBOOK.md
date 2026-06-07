# Purechess — Operational Runbook

## Apps

| App | Fly name | URL |
|---|---|---|
| API (NestJS) | `purechess-api` | `https://purechess-api.fly.dev` |
| Web (Next.js) | `purechess-web` | `https://purechess.com` |

---

## Deploy

### Automated (push to main)

```bash
git push origin main
# GitHub Actions runs CI, then prompts for prod approval in the "prod" environment.
# Approve at: https://github.com/your-org/purechess/actions
```

### Manual trigger

```bash
gh workflow run deploy.yml
```

### Direct Fly deploy (emergency)

```bash
flyctl deploy --app purechess-api --dockerfile apps/api/Dockerfile --remote-only
flyctl deploy --app purechess-web --dockerfile apps/web/Dockerfile --remote-only
```

---

## Rollback

### Rollback to previous release

```bash
# List releases
flyctl releases list -a purechess-api
flyctl releases list -a purechess-web

# Rollback to a specific version
flyctl releases rollback <version> -a purechess-api
flyctl releases rollback <version> -a purechess-web
```

Rollback completes in under 5 minutes. Fly machines are replaced rolling.

### Rollback database migration

Migrations are forward-only in MVP. If a migration breaks prod:

1. Rollback the app to the previous release (above).
2. The old schema is still compatible — the previous release never wrote the new columns.
3. File a follow-up migration to fix the schema forward.

---

## Secrets

Set via `flyctl secrets set`. **Never commit secrets.**

```bash
flyctl secrets set SESSION_SECRET="..." -a purechess-api
flyctl secrets set DATABASE_URL="postgresql://..." -a purechess-api
flyctl secrets set REDIS_URL="rediss://..." -a purechess-api
flyctl secrets set SENTRY_DSN="https://..." -a purechess-api
flyctl secrets set POSTHOG_API_KEY="..." -a purechess-api
flyctl secrets set GOOGLE_CLIENT_ID="..." -a purechess-api
flyctl secrets set GOOGLE_CLIENT_SECRET="..." -a purechess-api
flyctl secrets set APPLE_CLIENT_ID="..." -a purechess-api
flyctl secrets set APPLE_CLIENT_SECRET="..." -a purechess-api
flyctl secrets set WEB_URL="https://purechess.com" -a purechess-api

# Web app
flyctl secrets set NEXT_PUBLIC_SENTRY_DSN="..." -a purechess-web
flyctl secrets set NEXT_PUBLIC_POSTHOG_KEY="..." -a purechess-web
```

List secrets (values redacted):

```bash
flyctl secrets list -a purechess-api
flyctl secrets list -a purechess-web
```

---

## Database

### Connect to production Postgres

```bash
flyctl postgres connect -a purechess-db
# or via DATABASE_URL directly:
psql "$DATABASE_URL"
```

### Run migrations manually

```bash
# From a one-off Fly machine (preferred in prod):
flyctl machine run \
  --app purechess-api \
  --image registry.fly.io/purechess-api:latest \
  --restart no --rm \
  -- sh -c "npx prisma migrate deploy"

# Or locally (requires DATABASE_URL_DIRECT set to bypass pooler):
DATABASE_URL="$DATABASE_URL_DIRECT" pnpm db:migrate:deploy
```

### Backup

Daily backups run via `scripts/db-backup.sh`. Backups are stored in Cloudflare R2 bucket `purechess-backups`.

Manual backup:

```bash
R2_BUCKET=purechess-backups \
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com \
R2_ACCESS_KEY_ID=<key> \
R2_SECRET_ACCESS_KEY=<secret> \
DATABASE_URL="$DATABASE_URL_DIRECT" \
./scripts/db-backup.sh
```

### Restore from backup

1. Download backup from R2:
   ```bash
   aws s3 cp s3://purechess-backups/<filename>.dump.gz . \
     --endpoint-url https://<account>.r2.cloudflarestorage.com
   ```
2. Decompress:
   ```bash
   gunzip <filename>.dump.gz
   ```
3. Restore:
   ```bash
   pg_restore --clean --no-acl --no-owner \
     -d "$DATABASE_URL_DIRECT" <filename>.dump
   ```

---

## Redis

### Connect to Upstash Redis

```bash
redis-cli -u "$REDIS_URL"
```

### Check Redis status

```bash
redis-cli -u "$REDIS_URL" ping
# → PONG
```

Redis data that can be safely flushed (queues, presence, active game cache):

```bash
redis-cli -u "$REDIS_URL" flushdb
```

---

## Logs

```bash
# API logs (live)
flyctl logs -a purechess-api

# Web logs
flyctl logs -a purechess-web

# Last N lines
flyctl logs -a purechess-api -n 200
```

Structured JSON logs include `requestId` (X-Request-Id), `userId`, `level`, `msg`.

---

## Health Checks

```bash
# API
curl https://purechess-api.fly.dev/api/health
# → {"status":"ok","db":"ok","redis":"ok","uptime":1234}

# Web
curl https://purechess.com/api/health
# → {"status":"ok"}
```

Returns 503 if any dependency (db or redis) is unhealthy.

---

## Scaling

```bash
# Scale API to 2 instances
flyctl scale count 2 -a purechess-api

# Scale back to 1
flyctl scale count 1 -a purechess-api

# Show current machines
flyctl status -a purechess-api
flyctl status -a purechess-web
```

---

## Cloudflare

- DNS: `purechess.com` and `*.purechess.com` proxied through Cloudflare.
- SSL mode: **Full (strict)**.
- Origin cert: Fly-issued Let's Encrypt cert.
- WAF: Cloudflare Managed Rules enabled.
- Rate limit: `/api/auth/*` — 20 req/min per IP. `/realtime` WS upgrades — 10/min per IP.
- Cache bypass: `/api/*` and `/realtime`.
- Cache: `/`, `/_next/static/*`, public profiles, public game reviews (60s TTL).

To purge Cloudflare cache:

```bash
# Via Cloudflare dashboard → Caching → Configuration → Purge Everything
# Or via API:
curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone_id>/purge_cache" \
  -H "Authorization: Bearer <CF_API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

## Incident Response

### API is down (503)

1. Check health: `curl https://purechess-api.fly.dev/api/health`
2. Check Fly status: `flyctl status -a purechess-api`
3. Check logs: `flyctl logs -a purechess-api`
4. If DB unhealthy: check Neon dashboard for outage.
5. If Redis unhealthy: check Upstash dashboard.
6. Rollback if recent deploy caused it: `flyctl releases rollback <version> -a purechess-api`

### High error rate in Sentry

1. Open Sentry → Issues → filter by `purechess-api`.
2. Find the top error, read the stack trace.
3. Check if correlated with a recent deploy via `flyctl releases list -a purechess-api`.
4. Rollback if needed.

### Database connection pool exhausted

1. Check Neon dashboard for active connections.
2. Verify `DATABASE_URL` uses the pooler URL (`?pgbouncer=true`).
3. Reduce `connection_limit` in Prisma schema if needed (add `?connection_limit=5` to DATABASE_URL).
