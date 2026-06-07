# Epic: Purechess MVP

> Pure chess. Nothing else.

This epic implements the full MVP of **Purechess**, a minimalist online chess platform. The goal is to ship a polished, real-time chess experience that beats incumbents on speed, cleanliness, and board feel — without the bloat of features like clubs, lessons, puzzles, bots, or content.

## Goals

- Real-time chess (bullet / blitz / rapid) with server-authoritative state.
- Fast matchmaking with rating-based pair expansion.
- Glicko-2 ratings per category.
- Clean, mobile-first board UX (the product's centerpiece).
- Auth (email + OAuth), profiles, game history, post-game review, PGN export.
- Admin tools for reports and moderation.
- Deployable to Fly.io / Railway with Supabase/Neon Postgres + Upstash Redis.

## Architecture

```
Browser (Next.js + chessboard)
   │   HTTPS / WebSocket
   ▼
Next.js App
   │   REST + WebSocket
   ▼
NestJS API
   │   Socket.IO Gateway
   ▼
Redis (queues, active games, presence, clocks)
   │   persist on completion
   ▼
PostgreSQL via Prisma (durable history)
```

The chess engine, clock logic, and result detection are **server-authoritative**. The client previews legal moves for UX, but every move is validated and confirmed by the server.

## Non-Goals (Explicit)

Out of scope for this MVP: lessons, video, clubs, forums, streams, tournaments, puzzles, variants, bots, coaches, team battles, news/blog, full engine cloud analysis, native apps.

## Sessions Overview (25 total, 7 waves)

### Wave 1 — Foundation (sequential, blocking)

| # | Session | What it builds |
|---|---------|----------------|
| 01 | [Project scaffolding & monorepo](./purechess-mvp/session-01-project-scaffolding.md) | Monorepo, Next.js app, NestJS app, shared types, tooling, env config |
| 02 | [Database schema & Prisma](./purechess-mvp/session-02-database-prisma.md) | Prisma schema, migrations, seed data, repository helpers |
| 03 | [Design system & UI foundation](./purechess-mvp/session-03-design-system.md) | Tailwind, shadcn/ui, design tokens, core layout, theme switcher |

### Wave 2 — Core backend (parallel)

| # | Session | What it builds |
|---|---------|----------------|
| 04 | [Authentication module](./purechess-mvp/session-04-authentication.md) | Email/password, Google + Apple OAuth, sessions, password recovery |
| 05 | [Chess engine core (server)](./purechess-mvp/session-05-chess-engine-core.md) | Move validation, game state machine, check/mate/stalemate, clocks |
| 06 | [Realtime infrastructure](./purechess-mvp/session-06-realtime-infrastructure.md) | Socket.IO gateway, Redis adapter, presence, reconnection |
| 07 | [Users module & profile API](./purechess-mvp/session-07-users-profiles.md) | User CRUD, public profiles, stats, recent games API |

### Wave 3 — Gameplay backend (parallel)

| # | Session | What it builds |
|---|---------|----------------|
| 08 | [Game service & gateway](./purechess-mvp/session-08-game-service-gateway.md) | Create game, moves, resign, draw, timeout, reconnection events |
| 09 | [Matchmaking service](./purechess-mvp/session-09-matchmaking.md) | Queues, rating range expansion, cancellation, rated/casual split |
| 10 | [Rating system (Glicko-2)](./purechess-mvp/session-10-rating-system.md) | Per-category Glicko-2, rating deltas, history tracking |
| 11 | [Game persistence & PGN](./purechess-mvp/session-11-game-persistence.md) | Save completed games, move records, PGN generation, fair-play signals |

### Wave 4 — Core frontend (parallel)

| # | Session | What it builds |
|---|---------|----------------|
| 12 | [Chess board component](./purechess-mvp/session-12-chess-board-component.md) | Drag/drop, click-move, premoves, mobile, sounds, coordinates |
| 13 | [Play page & matchmaking UI](./purechess-mvp/session-13-play-page.md) | Time control selection, casual/rated/friend, queue state, cancel |
| 14 | [Active game page](./purechess-mvp/session-14-active-game-page.md) | Live board, clocks, move list, captured pieces, game controls |
| 15 | [Auth pages](./purechess-mvp/session-15-auth-pages.md) | Login, register, OAuth, password recovery flows |

### Wave 5 — Secondary frontend (parallel)

| # | Session | What it builds |
|---|---------|----------------|
| 16 | [Landing page](./purechess-mvp/session-16-landing-page.md) | Hero, CTAs, trust statements, no clutter |
| 17 | [Profile & game history](./purechess-mvp/session-17-profile-history.md) | Own/public profile, ratings, stats, recent games with filters |
| 18 | [Game review page](./purechess-mvp/session-18-game-review.md) | Move-by-move replay, PGN copy/download, keyboard shortcuts |

### Wave 6 — Admin, friend invite, polish (parallel)

| # | Session | What it builds |
|---|---------|----------------|
| 19 | [Admin module](./purechess-mvp/session-19-admin-module.md) | User/game/report views, search, disable/enable accounts |
| 20 | [Reports & fair play](./purechess-mvp/session-20-reports-fairplay.md) | Report button, admin review page, basic signals tracking |
| 21 | [Play a friend (invite link)](./purechess-mvp/session-21-friend-invite.md) | Invite link generation, friend game flow |
| 22 | [Board settings & themes](./purechess-mvp/session-22-board-settings.md) | Sound, coordinates, board theme (light/dark/alt), persistence |

### Wave 7 — Production readiness (mostly sequential)

| # | Session | What it builds |
|---|---------|----------------|
| 23 | [Observability & analytics](./purechess-mvp/session-23-observability.md) | Sentry, PostHog, structured logging, error boundaries |
| 24 | [Deployment & infrastructure](./purechess-mvp/session-24-deployment.md) | Fly.io/Railway configs, env management, Cloudflare, CI |
| 25 | [E2E testing, QA & docs](./purechess-mvp/session-25-e2e-qa-docs.md) | Critical-path E2E tests, release checklist, README, ADRs |

## Wave Dependency Diagram

```
Wave 1
   01 ──► 02 ──► 03
            │
            ▼
Wave 2
   04   05   06   07
    \    \    \   /
     \    \    \ /
      \    \    X
Wave 3  \    \ / X
   08 ──08  09  10  11
            \   \   /
             \   \ /
              ▼   ▼
Wave 4
   12   13   14   15
    \   /     \  /
     \ /       \/
Wave 5
   16   17   18
Wave 6
   19   20   21   22
Wave 7
   23 ──► 24 ──► 25
```

Each session's `depends_on` frontmatter pins the exact preconditions. Parallel siblings declare non-overlapping `touches` globs so `--strict` will catch any merge conflicts before they happen.

## Running the Epic

```bash
# Preview the DAG
python scripts/epic-dag.py --show docs/claude-sessions/purechess-mvp/

# Dry run the whole thing
bash scripts/run-sessions.sh docs/claude-sessions/purechess-mvp/ --dry-run

# Run for real
bash scripts/run-sessions.sh docs/claude-sessions/purechess-mvp/
```

Use `--max-parallel 4` (default) to keep resource use sane. Use `--strict` in development to enforce the no-overlap rule on parallel waves.

## Conventions Across All Sessions

- **TypeScript everywhere** — no plain JS in app code.
- **Server-authoritative game state** — never trust the client for moves, clocks, results.
- **Tailwind + shadcn/ui** — no ad-hoc CSS, no other UI libs.
- **Prisma for DB** — no raw SQL in app code (use `$queryRaw` only for opt-in cases).
- **Zustand for client state**, **TanStack Query for server state** — no Redux, no SWR.
- **chess.js for client move preview** — server uses its own engine implementation.
- **No comments in code** — let the code speak; PRD and ADRs are the source of truth.
- **No native apps, no theme marketplace, no content features** — every session stays in MVP scope.

## Out-of-Scope Watch List

If a session is tempted to add any of the following, push back and re-scope:

- Full Stockfish cloud analysis
- Engine accuracy / blunder classification
- Opening explorer / tablebase
- Tournaments, clubs, lessons, puzzles
- Bots (any kind)
- Native iOS / Android
- A theme marketplace
- News / blog / content management
