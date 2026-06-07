# Session 23 Handoff — Observability

## What Was Built

### API (`apps/api/src/`)

**New files:**

- `observability/sentry.ts` — `initSentry()` reads `SENTRY_DSN`; skips init if blank (dev). Trace sample rate `1.0` prod / `0` dev. Registers uncaught exception + unhandled rejection integrations.
- `observability/all-exceptions.filter.ts` — `@Catch()` global filter. Captures exceptions with `status >= 500` to Sentry via `withScope`. Attaches `id`, `username`, `isAdmin` from `req.user`. Returns correct HTTP status for all exceptions.
- `analytics/posthog.service.ts` — `PosthogService` wraps `posthog-node`; no-ops if `POSTHOG_API_KEY` absent. Exposes `captureEvent(distinctId, event, props)`. Implements `OnModuleDestroy` to flush.
- `analytics/analytics.module.ts` — `@Global()` module; exports `PosthogService`.
- `metrics/metrics.service.ts` — In-memory `MetricsService`. Methods: `setActiveGames`, `setQueueDepth`, `recordMatchWait`, `incrementMoveCount`, `incrementErrorCount`, `getSnapshot()`. Rolling 5-min window for wait avg; 1-sec window for moves/sec; 1-min window for errors/min. Resets on restart (acceptable for MVP).
- `metrics/metrics.controller.ts` — `GET /api/metrics` returns `MetricsSnapshot` JSON. No auth (internal use, session 24 wires alerts).
- `metrics/metrics.module.ts` — `@Global()` module; exports `MetricsService`.

**Modified files:**

- `src/main.ts` — `import './observability/sentry'` is line 1 (before reflect-metadata). Calls `initSentry()`. Uses `bufferLogs: true` + `app.useLogger(app.get(Logger))` for nestjs-pino. Middleware sets `X-Request-Id` header if absent. Registers `AllExceptionsFilter` globally.
- `src/app.module.ts` — Added `LoggerModule.forRootAsync()` (nestjs-pino): JSON in prod, pino-pretty in dev; redacts `cookie`, `authorization`, `password`, `token`; threads `X-Request-Id` via `genReqId`. Added `AnalyticsModule`, `MetricsModule`.
- `src/config/env.config.ts` — Added `SENTRY_DSN`, `SENTRY_ENV`, `POSTHOG_API_KEY`, `POSTHOG_HOST` (all optional, defaulted).

### Web (`apps/web/`)

**New files:**

- `sentry.client.config.ts` — `@sentry/nextjs` client init; Replay 100% sessions prod; browser tracing on. Guards on `NEXT_PUBLIC_SENTRY_DSN`.
- `sentry.server.config.ts` — Server-side Sentry init; guards on `SENTRY_DSN`.
- `src/lib/posthog.ts` — `initPostHog()` singleton; DNT/GPC guard; exports `posthog` for direct event capture.
- `src/components/posthog-provider.tsx` — Client component; calls `initPostHog()` on mount; identifies user via TanStack Query `/api/auth/me`; calls `posthog.reset()` on logout.
- `src/components/error-boundary.tsx` — Class `ErrorBoundary`; `componentDidCatch` → `Sentry.captureException`; renders "Something went wrong. Refresh to try again." + "Copy error details" (copies Sentry event ID) + "Refresh" buttons.
- `src/components/home/home-viewed-tracker.tsx` — Client component; fires `home_viewed` on mount.
- `src/app/global-error.tsx` — Root Next.js error boundary; captures to Sentry; same "Copy error details" + "Refresh" UI.
- `src/app/(play)/play/error.tsx` — Per-route error page for play route.
- `src/app/games/error.tsx` — Per-route error page for games list.
- `src/app/games/[gameId]/error.tsx` — Per-route error page for game detail.

**Modified files:**

- `next.config.js` — Wrapped with `withSentryConfig` (silent, hideSourceMaps, no Vercel monitors).
- `src/app/providers.tsx` — Added `<PostHogProvider>` wrapping children inside `QueryClientProvider`.
- `src/app/error.tsx` — Enhanced: reports to Sentry, shows event ID, "Copy error details" button.
- `src/app/page.tsx` — Added `<HomeViewedTracker />`.
- `src/app/(play)/play/play-page-client.tsx` — Added `posthog.capture('play_clicked', { mode: 'friend' })` on friend mode click.
- `src/components/reports/report-dialog.tsx` — Added `posthog.capture('report_filed', { reason })` on successful report creation.

**Scripts:**

- `scripts/upload-sourcemaps.sh` — CI script using `@sentry/cli`; requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

### Tests

**API** (`apps/api/test/observability/`):
- `sentry.spec.ts` — 4 tests: captureException returns event id, withScope sets user context, `AllExceptionsFilter` captures 500 to Sentry, filter does NOT capture 4xx to Sentry.
- `logging.spec.ts` — 2 tests: redact config covers all sensitive fields, cookie value not in log output.

**Web** (`apps/web/test/posthog/`):
- `events.test.tsx` — 5 tests: `HomeViewedTracker` fires `home_viewed`, `play_clicked`, `report_filed`, `identify`, `reset`.

## Verification Evidence

```
# API typecheck — zero new errors (pre-existing: @purchess/shared unlinked, @prisma/client not generated)
pnpm --filter @purchess/api typecheck → no errors in src/observability, src/analytics, src/metrics, src/app.module, src/main

# API observability tests
pnpm --filter @purchess/api test --testPathPattern="test/observability"
→ Test Suites: 2 passed; Tests: 6 passed

# Web typecheck — zero new errors
pnpm --filter @purchess/web typecheck → no new errors from session 23 code

# Web tests (all)
pnpm --filter @purchess/web test
→ Test Files: 15 passed; Tests: 108 passed
```

## Open Issues / Known Gaps

- **Server PostHog events not yet wired**: `PosthogService` is injectable globally, but `game_completed`, `matchmaking_joined`, `match_found`, `game_started`, `game_abandoned`, `rated_game_completed` are not called yet — those services (GamesService, MatchmakingService, RatingsService) are stubs from prior sessions. Session 24 or the session that fills those stubs should inject `PosthogService` and call `captureEvent`.
- **`registered` event**: No register form exists yet. The hook site in `PosthogService` is ready; wire it when the auth register flow is built.
- **Source map upload**: `upload-sourcemaps.sh` runs `sentry-cli` via `npx` — requires `@sentry/cli` installed. It's a transitive dep of `@sentry/nextjs` and will be available in CI after `pnpm install`.
- **MetricsService state resets on restart**: Acceptable for MVP. Session 24 (deployment/alerts) can decide if Redis persistence is needed.
- **`X-Request-Id` downstream propagation**: The header is set on incoming requests but not yet forwarded to outbound HTTP calls (no HTTP client module exists). When an outbound client is added, read `req.id` and set the header.
- **GDPR/EU residency**: `NEXT_PUBLIC_POSTHOG_HOST` defaults to `https://eu.posthog.com` in `.env.example`. Document the choice in the privacy page when it's built.

## Outputs Downstream Sessions Can Rely On

| Symbol / Path | Consumer |
|---|---|
| `PosthogService.captureEvent(distinctId, event, props)` injectable globally | Any NestJS service needing server-side analytics |
| `MetricsService.{setActiveGames,setQueueDepth,recordMatchWait,incrementMoveCount,incrementErrorCount}` injectable globally | Session 24 alerts, matchmaking service |
| `GET /api/metrics` → `MetricsSnapshot` JSON | Session 24 (deployment/alerting) |
| `AllExceptionsFilter` registered globally | All unhandled API errors surface in Sentry automatically |
| `ErrorBoundary` at `apps/web/src/components/error-boundary.tsx` | Any page needing per-component error isolation |
| `posthog` singleton at `apps/web/src/lib/posthog.ts` | Any client component needing to fire analytics events |
| `SENTRY_DSN`, `POSTHOG_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY` documented in `.env.example` | Session 24 prod wiring |
| nestjs-pino JSON logs with `X-Request-Id` in every line | Log aggregation / debugging |
