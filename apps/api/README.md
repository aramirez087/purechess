# @purchess/api

NestJS 10 backend for Purchess.

## Purpose

Handles all game logic, matchmaking, ratings, authentication, WebSocket events, and admin operations. The server is authoritative for all game state — the client never submits board positions, only move intentions.

## Run

```bash
# Development (from repo root)
pnpm dev:api

# Or standalone
pnpm --filter @purchess/api dev
```

Runs on **port 4000**.

Health check: `GET /api/health` → `{ status: "ok", db: "ok", redis: "ok", uptime: N }`

## Key Folders

```
src/
  auth/           # Session auth, OAuth (Google, Apple), password reset
  users/          # Profile, game history
  games/          # Game CRUD, move submission, game lifecycle
  matchmaking/    # Queue management, pairing algorithm
  ratings/        # Glicko-2 rating updates
  realtime/       # Socket.IO gateway
  invites/        # Friend invite links
  admin/          # User management, reports, audit log
  reports/        # Fair-play reports
  analytics/      # PostHog event tracking
  metrics/        # Prometheus /metrics endpoint
  observability/  # Sentry integration, structured logging
  redis/          # Global Redis client (ioredis)
  database/       # Prisma service
  testing/        # Test-only endpoints (NODE_ENV=test only)
  config/         # Env validation (Joi)
```

## Test

```bash
# Unit tests
pnpm --filter @purchess/api test

# Integration tests (requires DB)
pnpm --filter @purchess/api test:e2e
```

## Database

Prisma schema at `prisma/schema.prisma`. Run migrations:

```bash
pnpm --filter @purchess/api db:migrate      # dev (creates migration)
pnpm db:migrate:deploy                       # prod (applies existing)
```

## Environment

Key env vars (see `.env.example`):

| Key | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon pooler URL) |
| `DATABASE_URL_DIRECT` | Postgres direct URL (for migrations) |
| `REDIS_URL` | Redis connection string |
| `SESSION_SECRET` | Min 32-char secret for session HMAC |
| `OAUTH_GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `OAUTH_APPLE_CLIENT_ID` | Apple OAuth client ID |
| `SENTRY_DSN` | Sentry DSN (optional) |
| `POSTHOG_API_KEY` | PostHog server-side key (optional) |
