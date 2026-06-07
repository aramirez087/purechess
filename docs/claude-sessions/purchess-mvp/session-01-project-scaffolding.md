---
depends_on: []
touches:
  - "package.json"
  - "pnpm-workspace.yaml"
  - "tsconfig*.json"
  - ".gitignore"
  - ".editorconfig"
  - ".nvmrc"
  - ".env.example"
  - "apps/web/**"
  - "apps/api/**"
  - "packages/shared/**"
  - "scripts/**"
  - "README.md"
parallel_safe: false
model: sonnet
cli: opencode
---

# Session 01: Project Scaffolding & Monorepo

## Mission

Set up the **Purchess monorepo**: a pnpm workspace with a Next.js web app, a NestJS API, and a shared TypeScript package. Wire up the dev experience (lint, format, typecheck, scripts), env management, and a clean directory layout that every downstream session will respect.

This is the foundation. Every later session assumes this layout exists.

## Tasks

1. **Initialize pnpm workspace** at the repo root with `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`.
2. **Create `packages/shared`** — a TypeScript package exporting:
   - Chess types (`Color`, `Piece`, `Square`, `Move`, `GameState`).
   - Time control definitions (categories, seconds, increment).
   - Game result enum and reason codes.
   - WebSocket event names and payload types (mirrored by client and server).
   - Rating category enums.
   - API DTOs shared between web and api (request/response shapes).
3. **Scaffold `apps/web` (Next.js 14 App Router)** with:
   - TypeScript, Tailwind, ESLint, Prettier.
   - `src/app` for routes, `src/components`, `src/lib`, `src/hooks`, `src/stores`.
   - Base `app/layout.tsx`, `app/page.tsx` placeholder, `app/globals.css`.
   - TanStack Query provider in root layout.
   - Zustand installed and a sample store placeholder.
4. **Scaffold `apps/api` (NestJS 10)** with:
   - TypeScript, ESLint, Prettier, class-validator, class-transformer.
   - Modules folder structure (auth, users, games, matchmaking, ratings, reports, admin, realtime) — empty modules with `module.ts`/`controller.ts`/`service.ts` skeletons.
   - Global config module using `@nestjs/config` with typed env.
   - Global validation pipe + CORS configured.
   - Health check endpoint at `GET /health`.
5. **Root tooling**:
   - `package.json` scripts: `dev`, `dev:web`, `dev:api`, `build`, `lint`, `format`, `typecheck`, `test`.
   - `tsconfig.base.json` shared by all workspaces.
   - `.editorconfig`, `.gitignore` (node_modules, .next, dist, .env, .epic-worktrees), `.nvmrc` pinned to Node 20 LTS.
   - Prettier config + `.prettierignore`.
   - ESLint flat config extending recommended TS rules.
6. **Env management**:
   - `.env.example` at root with all required vars (DATABASE_URL, REDIS_URL, JWT_SECRET, OAUTH_CLIENT_ID_*, etc.).
   - `apps/web/.env.example` with `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`.
   - `apps/api/.env.example` with server-side vars only.
   - A `scripts/check-env.sh` that fails CI if `.env` is missing required keys.
7. **README** at the repo root explaining:
   - The architecture (link to EPIC.md).
   - Quickstart: `pnpm install`, `pnpm dev`.
   - Workspace layout.
   - Pointers to per-session docs in `docs/claude-sessions/purchess-mvp/`.
8. **Smoke checks**:
   - `pnpm typecheck` passes across all workspaces.
   - `pnpm lint` passes.
   - `pnpm dev:web` starts Next on :3000, shows placeholder.
   - `pnpm dev:api` starts Nest on :4000, `/health` returns 200.
   - CORS preflight from web origin succeeds on `/health`.

## Deliverables

- `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`.
- `packages/shared/` exporting typed constants and DTOs.
- `apps/web/` running Next.js App Router on :3000.
- `apps/api/` running NestJS on :4000 with `/health` 200.
- `.env.example` files at root, `apps/web`, `apps/api`.
- Lint, format, typecheck all green from a fresh clone.
- Updated root `README.md` with quickstart.

## Notes for Downstream Sessions

- All shared types live in `packages/shared` and are imported as `@purchess/shared`.
- WebSocket event names must be defined once in shared and imported by both sides.
- The API uses port 4000, web uses 3000 — keep that contract.
- NestJS modules live under `apps/api/src/<name>/<name>.module.ts` with parallel `controller.ts` and `service.ts`.
- Frontend pages live under `apps/web/src/app/<route>/page.tsx`. Route groups use parentheses: `(auth)`, `(play)`.
- Tailwind tokens are defined in `apps/web/tailwind.config.ts` and exposed as CSS variables in `globals.css` for shadcn/ui compatibility.
