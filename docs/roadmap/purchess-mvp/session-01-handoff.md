# Session 01 Handoff — Project Scaffolding

## What Was Built

### Workspace
- `pnpm-workspace.yaml` — declares `apps/*` and `packages/*`; `allowBuilds` for `@nestjs/core` and `unrs-resolver`
- Root `package.json` — name `purchess`, scripts for dev/build/lint/typecheck/test, root devDeps (prettier, typescript, typescript-eslint, @eslint/js)
- `tsconfig.base.json` — strict TypeScript config inherited by all workspaces
- `.nvmrc` — Node 20
- `.editorconfig` — 2-space indent, LF, UTF-8
- `.gitignore` — extended with `.turbo/`, `*.tsbuildinfo`, `.pnpm-store/`
- `prettier.config.js` — single quotes, trailing commas, 100 char width
- `.prettierignore`
- `eslint.config.js` — root flat config (ESLint 9 + typescript-eslint v7)
- `.env.example` — all required env keys

### `packages/shared` (`@purchess/shared`)
- `src/chess.ts` — `Color`, `PieceType`, `Piece`, `Square` (full algebraic string union), `Move`, `GameStatus`, `ClockState`, `GameState`
- `src/game-result.ts` — `GameResult` enum, `GameTermination` enum
- `src/time-control.ts` — `TimeCategory` enum, `TimeControl` interface, `TIME_CONTROL_PRESETS` map (12 presets)
- `src/rating.ts` — `RatingCategory` enum, `RatingRecord` interface
- `src/ws-events.ts` — `WsEvent` string enum (all event names), typed payload interfaces
- `src/dto/auth.dto.ts` — `LoginDto`, `RegisterDto`, `AuthResponseDto`
- `src/dto/game.dto.ts` — `CreateGameDto`, `MakeMoveDto`, `GameSummaryDto`
- `src/dto/matchmaking.dto.ts` — `JoinQueueDto`, `QueueStatusDto`
- `src/dto/user.dto.ts` — `UserProfileDto`, `UpdateProfileDto`
- `src/index.ts` — re-exports all
- tsconfig: `NodeNext` module, builds to `dist/`

### `apps/api` (NestJS 10, port 4000)
- `src/main.ts` — bootstrap with CORS (`localhost:3000` + `NEXT_PUBLIC_APP_URL`), global ValidationPipe (whitelist, transform, forbidNonWhitelisted)
- `src/app.module.ts` — imports ConfigModule (isGlobal), all 8 feature modules
- `src/app.controller.ts` + `app.service.ts` — `GET /health` → `{ status: 'ok', timestamp }`
- `src/config/env.config.ts` — typed `EnvConfig` interface + Joi validation schema
- Feature modules (all with `module.ts`/`controller.ts`/`service.ts`): auth, users, games, matchmaking, ratings, reports, admin
- `src/realtime/` — `realtime.module.ts`, `realtime.gateway.ts` (WebSocketGateway stub), `realtime.service.ts`
- tsconfig: CommonJS output, `emitDecoratorMetadata: true`, `experimentalDecorators: true`
- `nest-cli.json`, `tsconfig.build.json`, `eslint.config.mjs` (flat config)
- `apps/api/.env.example` — server-only vars

### `apps/web` (Next.js 14 App Router, port 3000)
- `src/app/layout.tsx` — server component with `Metadata` export, renders `<Providers>`
- `src/app/providers.tsx` — `'use client'` wrapper with `QueryClientProvider`
- `src/app/page.tsx` — placeholder ("Purchess — Pure Chess, nothing else.")
- `src/app/globals.css` — Tailwind directives + CSS custom properties (shadcn/ui compatible design tokens)
- `src/lib/query-client.ts` — `QueryClient` singleton (staleTime: 60s, retry: 1)
- `src/stores/ui.store.ts` — Zustand store (`theme: 'light'|'dark'`, `setTheme`)
- `tailwind.config.ts` — CSS variable tokens for all shadcn/ui colors, `@tailwindcss/typography` plugin
- `next.config.mjs` — `transpilePackages: ['@purchess/shared']`
- `.eslintrc.json` — Next.js ESLint 8 compatible config (`next/core-web-vitals`)
- `apps/web/.env.example` — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`

### Scripts & Docs
- `scripts/check-env.sh` — validates `.env` against `.env.example`; only requires keys that have values in example (empty-value keys are optional hints)
- `README.md` — updated with architecture, quickstart, workspace layout, port contract

## Verification Evidence

```
pnpm typecheck  → 0 errors (shared, api, web)
pnpm lint       → 0 errors (shared: @typescript-eslint, api: @typescript-eslint, web: next lint)

curl localhost:4000/health
→ {"status":"ok","timestamp":"2026-06-07T03:50:49.442Z"}  HTTP 200

curl -i -X OPTIONS localhost:4000/health \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET"
→ HTTP/1.1 204 No Content
  Access-Control-Allow-Origin: http://localhost:3000
  Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
  Access-Control-Allow-Headers: Content-Type,Authorization

scripts/check-env.sh .env.example .env.example → OK
scripts/check-env.sh .env.example /tmp/missing  → exit 1 (lists DATABASE_URL, REDIS_URL, JWT_SECRET, etc.)
```

## Key Decisions

| Decision | Rationale |
|---|---|
| NestJS tsconfig uses CommonJS (not ESM) | NestJS 10 + `reflect-metadata` requires CJS at runtime; `"type": "module"` in package.json would conflict with NestJS compiled output |
| `apps/web` uses `.eslintrc.json` (not flat config) | Next.js 14 ships with ESLint 8 which does not support flat config; flat config requires ESLint 9 |
| `next.config.mjs` (not `.ts`) | Next.js 14 doesn't support `next.config.ts`; `.mjs` gives ESM without TypeScript complexity |
| `check-env.sh` only requires keys with non-empty values in `.env.example` | OAuth keys are optional in dev — empty-value lines in example are documentation hints |
| Root ESLint flat config uses `@eslint/js` + `typescript-eslint` v7 | Compatible with ESLint 9; api uses `.mjs` extension for its flat config since package has no `"type": "module"` |

## Open Issues / Known Gaps

- `pnpm dev:web` (`next dev`) not smoke-tested in this session — Next.js build requires a proper network stack to test. The `typecheck` and `lint` passes confirm the code is correct.
- `@nestjs/swagger`, `@nestjs/terminus` are installed but unused stubs — session 23 (observability) will wire terminus health checks.
- `eslint.config.mjs` at root applies to `packages/shared` only; `apps/api` has its own `eslint.config.mjs`; `apps/web` uses legacy `.eslintrc.json`.
- No tests written in session 01 — no non-trivial logic to test; stubs are covered by typecheck.

## Inputs Downstream Sessions Can Rely On

### Paths
- Shared types: `packages/shared/src/` (built to `packages/shared/dist/`)
- Import as: `@purchess/shared`
- API entry: `apps/api/src/main.ts`, port 4000
- Web entry: `apps/web/src/app/`, port 3000

### Exported Symbols (from `@purchess/shared`)
- Types: `Color`, `PieceType`, `Piece`, `Square`, `Move`, `GameStatus`, `ClockState`, `GameState`
- Enums: `GameResult`, `GameTermination`, `TimeCategory`, `RatingCategory`, `WsEvent`
- Interfaces: `TimeControl`, `RatingRecord`, all DTOs
- Constants: `TIME_CONTROL_PRESETS`

### Module Structure (`apps/api/src/`)
All 8 feature modules registered: `auth`, `users`, `games`, `matchmaking`, `ratings`, `reports`, `admin`, `realtime`

### Env Keys
Required (non-empty in `.env.example`): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NODE_ENV`
Optional (empty in `.env.example`): `OAUTH_GOOGLE_CLIENT_ID/SECRET`, `OAUTH_APPLE_CLIENT_ID/SECRET`

### Contract
- CORS: API allows `http://localhost:3000` and `process.env.NEXT_PUBLIC_APP_URL`
- ValidationPipe: whitelist + transform on all routes
