# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## OpenWolf

@.wolf/OPENWOLF.md

This project uses OpenWolf for context management. Read and follow .wolf/OPENWOLF.md every session. Check .wolf/cerebrum.md before generating code. Check .wolf/anatomy.md before reading files.

## Commands

Run from repo root (pnpm workspace). Node >=20, pnpm >=9.

| Command | Purpose |
|---|---|
| `pnpm dev` | web (:3000) + api (:4000) in parallel |
| `pnpm dev:web` / `pnpm dev:api` | single app |
| `pnpm build` | builds `@purechess/shared` first, then apps |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | all workspaces (`-r`) |
| `pnpm test` | unit tests, all workspaces |
| `pnpm e2e` | Playwright browser E2E (web) |
| `pnpm smoke` | `scripts/smoke.sh` perf smoke test |
| `pnpm infra:up` / `infra:down` / `infra:reset` | local Postgres + Redis via Docker |
| `pnpm db:migrate:deploy` | apply Prisma migrations |
| `pnpm engine:shadow` | ts-vs-native engine parity over 200+ game traces (`scripts/shadow-runner.ts`) |

**Local bootstrap:** `pnpm install` → `cp .env.example .env` (set `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`) → `pnpm infra:up` → `pnpm db:migrate:deploy` → `pnpm dev`.

**API (NestJS, Jest)** — run from `apps/api`:
- `pnpm test` — Jest, matches `test/**/*.spec.ts`. Single test: `pnpm exec jest test/foo.spec.ts -t "name"`.
- `pnpm test:e2e` — `jest.e2e.config.js`, `--runInBand`, `NODE_ENV=test`.
- Prisma: `pnpm db:migrate` (dev), `db:seed`, `db:reset`, `db:generate`, `db:studio`.
- The chess engine (`src/chess/engine/`) has an enforced coverage gate: 90% lines/functions, 85% branches (`native-adapter.ts` and `index.ts` excluded). Keep it covered.

**Web (Next.js, Vitest)** — run from `apps/web`:
- `pnpm test` — Vitest (`vitest run`), tests in `test/`. Watch: `pnpm test:watch`. Single file: `pnpm exec vitest run test/board/foo.test.ts`.
- `pnpm e2e` — Playwright, specs in `e2e/`; `pnpm e2e:setup` runs `e2e/global-setup.js`.

**Rust engine** — run from `crates/purechess-engine`:
- `cargo test --features impl` — perft + parity + result-detection suites. Without `--features impl` the crate is a stub-only spec pass (zero perft assertions).
- `cargo clippy --all-targets --features impl -- -D warnings` — CI gate (`rust-parity` job), warnings are errors.
- `scripts/build-engine.sh` — builds the napi `.node` binary for the host platform (needed to run the native engine locally; not required for dev, TS engine is the default fallback).

## Architecture

pnpm monorepo, all ESM (`"type": "module"`), plus a Rust workspace (`Cargo.toml` at root). Workspaces:

- **`apps/web`** — Next.js 14 App Router. Radix UI + Tailwind + `class-variance-authority`, Zustand stores (`src/stores`), TanStack Query, `chess.js` for client-side board logic, Socket.IO client for live games. Routes under `src/app` include `(play)`, `games/[gameId]`, `computer-game/[gameId]`, `invite/[token]`, `profile`, `settings`, and a full `admin/` section. Stockfish runs **client-side in a Web Worker** (`public/stockfish`) — computer games do not hit the API engine.
- **`apps/api`** — NestJS 10. Feature modules wired in `src/app.module.ts`: Auth, Users, Games, Matchmaking, Ratings, Invites, Realtime, ComputerGames, Reports, Admin, Analytics, Metrics, plus infra modules Database (Prisma), Redis (ioredis), Logger (pino), Throttler, Observability (Sentry). REST + Socket.IO on :4000.
- **`packages/shared`** — `@purechess/shared`: shared TypeScript types, DTOs (`src/dto`), and the `WsEvent` enum + WS payload interfaces (`src/ws-events.ts`) used by both apps. **Must be built before apps** (`pnpm build` does this; API Jest maps the import to `src/index.ts` directly so tests skip the build step).
- **`crates/purechess-engine`** — Rust chess engine core (shakmaty-based): movegen, FEN, PGN, result detection. Feature-gated: `impl` enables real bodies + perft suite, `ffi` enables the napi-rs surface. Exposed to Node via **`packages/engine-native`** (`@purechess/engine-native`, napi-rs shim).

**Authoritative game state lives on the API.** The server validates every move with the engine in `apps/api/src/chess/engine/` (`move-validator`, `game-state`, `clock`, `result-detector`, `fen-utils`, `pgn-builder`), persists it, and broadcasts via the Socket.IO gateway (`src/realtime/`). Clients are not trusted for move legality. All WS event names come from the `WsEvent` enum in shared — use it, never raw strings.

**Engine adapter layer:** the API talks to the engine through the `EngineAdapter` interface (`adapter.ts`) with three implementations selected by `ENGINE_BACKEND` (`engine-backend.config.ts`, wired in `chess.module.ts`): `ts` → `TsEngineAdapter` (legacy chess.js), `native` → `NativeEngineAdapter` (Rust via napi), `shadow-ts` → `ShadowAdapter` (runs both, TS result wins, logs divergences). Unset locally falls back to TS; production (`apps/api/fly.toml`) sets `native`. The TS engine is the rollback path — don't delete it; cutover/rollback runbook at `docs/runbooks/engine-cutover.md`. Behavior changes must keep both engines in parity — CI jobs `engine-shadow` (trace replay) and `rust-parity` (cargo test + clippy) enforce this.

**Game lifecycle:** matchmaking (rated games filter by `category` + `timeControlSeconds`) or friend invite (`invite_pending → active`) creates a `Game`; moves flow over WS; on completion `RatingsService.processGameResult()` runs **Glicko-2**, writes `Rating` + `RatingHistory`. See `docs/ARCHITECTURE.md` for full data flows, the game status state machine, and ADRs.

**Persistence:** Postgres (Neon) via Prisma — schema at `apps/api/prisma/schema.prisma`. Redis (ioredis) for ephemeral realtime/matchmaking state. Supabase for auth alongside Passport Google/Apple OAuth (argon2/bcrypt for local creds).

**ESM gotcha:** shared uses explicit `.js` extensions in relative imports (e.g. `'./chess.js'`). API Jest maps these back via `moduleNameMapper`. Match the existing import style when editing shared.

**Deployment:** both apps deploy to Fly.io (`purechess-api` / `purechess-web`) via `.github/workflows/deploy.yml` — `flyctl deploy . -c apps/<app>/fly.toml` (the `.` context + `-c` flag are deliberate; see comments in the workflow). Ops runbooks in `infra/RUNBOOK.md` and `docs/runbooks/`.

## Conventions

- TypeScript everywhere. Prettier + ESLint flat config (`eslint.config.js`) enforced at root.
- DTOs/types shared between web and api belong in `packages/shared`, not duplicated.
- Analytics: PostHog (`posthog-js` web, `posthog-node` api) — see `posthog-setup-report.md`.
