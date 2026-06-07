---
depends_on: [19, 20, 21, 22]
touches:
  - "apps/api/src/observability/**"
  - "apps/api/src/observability/observability.module.ts"
  - "apps/api/src/observability/sentry.service.ts"
  - "apps/api/src/observability/logger.service.ts"
  - "apps/api/src/observability/metrics.service.ts"
  - "apps/web/src/lib/observability/**"
  - "apps/web/src/lib/observability/sentry-client.ts"
  - "apps/web/src/lib/observability/posthog-client.ts"
  - "apps/web/src/components/error-boundary.tsx"
  - "apps/web/src/app/global-error.tsx"
  - "apps/web/instrumentation.ts"
  - "apps/api/src/main.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 23: Observability & Analytics

## Mission

Wire Sentry for error tracking, PostHog for product analytics, and structured logging throughout. The goal is to be able to debug any production issue from the first user report and to know whether the launch is hitting its activation / retention / matchmaking targets.

No Grafana/Prometheus in MVP — that's overkill at launch. Sentry + PostHog + structured logs is enough.

## Tasks

1. **Sentry (server)**:
   - `@sentry/node` initialized in `apps/api/src/main.ts` before any other import.
   - DSN from `SENTRY_DSN` env var. Sample rate: `1.0` in prod, `0` in dev.
   - Capture unhandled rejections, uncaught exceptions, and NestJS exception filter output.
   - Source maps uploaded in CI (script in `scripts/upload-sourcemaps.sh`).
   - User context: attach `id`, `username`, `isAdmin` when available.
2. **Sentry (client)**:
   - `@sentry/nextjs` initialized in `apps/web/sentry.client.config.ts` and `apps/web/sentry.server.config.ts`.
   - Replay on for 100% of sessions in prod (low traffic at launch; can dial down later).
   - Browser tracing on for `/play/*` and `/games/*` (the routes with real interactivity).
   - Custom error boundary in `apps/web/src/components/error-boundary.tsx` reports caught errors to Sentry with `extra: { componentStack }`.
   - `apps/web/src/app/global-error.tsx` is the Next.js root error boundary.
3. **PostHog (client)**:
   - `posthog-js` initialized in a client-side provider.
   - Identify on login.
   - Capture the events the PRD's success metrics require:
     - `home_viewed`
     - `play_clicked`
     - `matchmaking_joined` `{ category, timeControlSeconds, isRated }`
     - `matchmaking_cancelled` `{ waitedMs }`
     - `match_found` `{ waitedMs }`
     - `game_started` `{ category, isRated }`
     - `game_completed` `{ result, reason, durationMs, moveCount }`
     - `game_abandoned` `{ reason }`
     - `rated_game_completed` `{ ratingDelta, newRating }`
     - `registered` `{ method: 'email' | 'google' | 'apple' }`
     - `report_filed` `{ reason }`
   - All events have `distinct_id` (PostHog user id) and standard `$set` properties (`app_version`, `theme`, `is_rated_player`).
   - DNT/GPC respected: if `navigator.doNotTrack === '1'`, do not initialize PostHog.
4. **Server-side analytics forwarding**:
   - For events that must be server-authoritative (e.g., `game_completed` — the client can lie about the result), the server captures them via PostHog's server-side SDK using the user's distinct_id.
   - Server emits `game_completed` and `matchmaking_*` events; client emits UX events (`play_clicked`, `home_viewed`).
5. **Structured logging**:
   - Use `nestjs-pino`. JSON logs in prod, pretty in dev.
   - Redact `cookie`, `authorization`, `password`, `token` from request logs.
   - Add a request id (`X-Request-Id`) to every log line; pass through to downstream calls.
6. **Operational metrics (lightweight, server)**:
   - `MetricsService` exposes simple counters and gauges via a `GET /metrics` endpoint in JSON (not Prometheus format — defer).
   - Tracks: active games count, queue depth per category, average match wait time (last 5 min), total moves/sec, error count per minute.
   - Used by Session 24 to wire alerts.
7. **Error boundary UI**:
   - App-level `ErrorBoundary` renders a calm message: "Something went wrong. Refresh to try again." with a "Copy error details" button (sends the Sentry event id to the user).
   - Per-page `error.tsx` for graceful degradation.
8. **Tests**:
   - Sentry: unhandled rejection in a test endpoint produces a Sentry event (use a fake transport).
   - PostHog: events fired in component tests are captured by the mock.
   - Log redaction: cookie value not in any log line.
9. **Verification**:
   - Trigger an error in dev; verify it shows in Sentry.
   - Sign up, play a game, verify the corresponding events land in PostHog.

## Deliverables

- Sentry wired on both sides with source maps.
- PostHog capturing the PRD's success-metric events.
- Structured logging across the API.
- Lightweight `/metrics` JSON endpoint.

## Notes for Downstream Sessions

- Session 24 (deployment) reads `SENTRY_DSN` and `POSTHOG_API_KEY` from env to wire prod instances.
- Session 25 (QA) writes a checklist that exercises each PostHog event.
- Do not over-instrument. 12 well-chosen events > 100 noisy ones. Stick to the list.
- GDPR posture: PostHog is configured for EU residency if Purchess launches in EU-first; flip the env vars. Document the choice in the privacy page (placeholder for now).

## Out of scope (defer)

- Prometheus + Grafana dashboards.
- Custom metrics for chess-specific things (e.g., "average game length by category") — can be derived from PostHog or from Prisma queries until traffic warrants real-time dashboards.
- Per-user error budgets.
