# @purchess/web

Next.js 14 App Router frontend for Purchess.

## Purpose

Renders the chess board, matchmaking UI, game review, profile pages, and admin panel. Communicates with the API via REST (TanStack Query) and WebSocket (Socket.IO).

## Run

```bash
# Development (from repo root)
pnpm dev:web

# Or standalone
pnpm --filter @purchess/web dev
```

Runs on **port 3000**.

## Key Folders

```
src/
  app/                  # Next.js App Router pages
    (auth)/             # Login, register, password reset
    (play)/             # Matchmaking, game board, invite
    games/[id]/         # Game review
    profile/[username]/ # User profile
    admin/              # Admin panel
  components/
    ui/                 # shadcn/ui copy-owned components
    board/              # Chess board component
    ...
  stores/               # Zustand client state
  hooks/                # TanStack Query hooks
  lib/                  # Utilities, API client
```

## Test

```bash
# Unit tests (Vitest)
pnpm --filter @purchess/web test

# Playwright E2E (requires running stack)
pnpm --filter @purchess/web e2e
```

## Environment

Key env vars (see `.env.example`):

| Key | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL (`http://localhost:4000`) |
| `NEXT_PUBLIC_APP_URL` | Web base URL (`http://localhost:3000`) |
| `SENTRY_DSN` | Sentry error tracking (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics (optional) |
