# Purchess

Pure chess, nothing else. See [docs/epics/purchess-mvp.md](docs/epics/purchess-mvp.md) for the full product spec.

## Architecture

```
Browser (Next.js 14)  ←→  NestJS API (:4000)  ←→  Neon (Postgres)
         ↕                      ↕
  WebSocket (Socket.IO)    Redis (queues/sessions)
```

- **web** (`apps/web`): Next.js 14 App Router, Tailwind, shadcn/ui, TanStack Query, Zustand.
- **api** (`apps/api`): NestJS 10, class-validator, Prisma (session 02), Socket.IO gateway.
- **shared** (`packages/shared`): TypeScript types, enums, DTOs, WebSocket event names.

## Quickstart

```bash
nvm use           # Node 20 LTS
pnpm install      # install all workspace deps
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, JWT_SECRET at minimum
pnpm dev          # starts web :3000 and api :4000 in parallel
```

Health check: `curl localhost:4000/health` → `{"status":"ok"}`

## Workspace Layout

| Path | Description |
|---|---|
| `apps/web/` | Next.js frontend |
| `apps/api/` | NestJS backend |
| `packages/shared/` | Shared types and DTOs (`@purchess/shared`) |
| `scripts/` | Dev tooling scripts |
| `docs/epics/` | Product spec |
| `docs/claude-sessions/purchess-mvp/` | Per-session implementation notes |
| `docs/roadmap/purchess-mvp/` | Session handoff docs |

## Ports

| Service | Port |
|---|---|
| Web | 3000 |
| API | 4000 |

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start web + api in parallel |
| `pnpm dev:web` | Start web only |
| `pnpm dev:api` | Start api only |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm format` | Format all files with Prettier |
| `pnpm test` | Run all tests |

## Env

Copy `.env.example` to `.env`. Required keys: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`.

Run `scripts/check-env.sh` to validate your `.env` before starting.

## Session Docs

Per-session implementation notes: `docs/claude-sessions/purchess-mvp/`
Session handoffs: `docs/roadmap/purchess-mvp/`
