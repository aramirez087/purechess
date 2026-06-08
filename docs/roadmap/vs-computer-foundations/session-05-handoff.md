# Session 05 Handoff — CI Gate / Go–No-Go Report

**Status: GO** — all seven quality gates pass. The vs-computer-foundations epic is
fully green; the UI epic can build on this trunk.

---

## Quality Gate Results

| # | Command | Initial Status | Fixed | Final Status |
|---|---------|---------------|-------|--------------|
| 0 | `pnpm install && pnpm --filter @purechess/api db:generate` | N/A | N/A | PASS |
| 1 | `pnpm --filter @purechess/shared build` | PASS | — | **PASS** |
| 2 | `pnpm -r typecheck` | FAIL (5 TS errors in web) | Yes | **PASS** |
| 3 | `pnpm -r lint` | FAIL (`eslint` not in PATH) | Yes | **PASS** |
| 4 | `cd apps/api && pnpm test` | FAIL (5 suites, 39 tests) | Yes | **PASS** (192/192) |
| 5 | `cd apps/web && pnpm exec vitest run test/` | FAIL (7 tests in 3 suites) | Yes | **PASS** (137/137) |
| 6 | `pnpm build` | PASS (after typecheck fix) | — | **PASS** |

Engine coverage gate (within gate 4): **PASS** — all thresholds met (≥90% lines,
≥90% functions, ≥85% branches on `src/chess/engine/`).

---

## What Was Fixed

### Gate 2 — Typecheck (5 errors → 0)

| File | Error | Fix |
|------|-------|-----|
| `apps/web/src/components/home/footer.tsx` | `TS2305` — `Github`/`Twitter` not exported from `lucide-react` (removed in v1.x) | Replaced with inline SVG components `GithubIcon` / `XIcon` |
| `apps/web/src/components/admin/games-table.tsx` | `TS2741` — `children` required in `Th` but self-closing tag passed | Made `children?: React.ReactNode` (optional) |
| `apps/web/src/components/admin/reports-table.tsx` | Same as above | Same fix |
| `apps/web/src/components/admin/admin-page-header.tsx` | `TS2322` — `description` typed `string` but JSX element passed from `admin/reports/[id]/page.tsx` | Changed to `description?: ReactNode` |

### Gate 3 — Lint (binary not found)

`eslint` was not a direct dependency in the workspace root, so `node_modules/.bin/eslint`
did not exist. `packages/shared` and `apps/api` both run `eslint src` directly and failed
with `eslint: command not found`. Fix: added `"eslint": "^9.0.0"` to root
`devDependencies` (the root `eslint.config.js` already used the v9 flat-config API via
`@eslint/js@9.x`).

### Gate 4 — API Tests (5 suites failing → 0)

| Suite | Root Cause | Fix |
|-------|-----------|-----|
| `test/computer-games/stockfish.service.spec.ts` | Imported `StockfishService` which was deleted in Session 01 (computer games run client-side Stockfish) | Deleted the stale spec |
| `test/reports/reports.service.spec.ts` | `ReportsService` gained `PosthogService` dep but test module didn't provide it | Added `{ provide: PosthogService, useValue: mockPosthog }` |
| `test/invites/invites.service.spec.ts` | Same missing `PosthogService` | Same fix |
| `test/auth/auth.service.spec.ts` | Same missing `PosthogService` | Same fix |
| `test/auth/auth.controller.spec.ts` | (a) Missing `PosthogService`; (b) stale assertion: `GET /api/auth/me` expected 401 but route uses `OptionalSessionAuthGuard` so it returns 200 `{user:null}` when unauthenticated | Added `PosthogService` mock; updated assertion to expect 200 with `{user:null}` |

`PosthogService` mock used in all affected specs:
```ts
const mockPosthog = { captureEvent: jest.fn(), captureException: jest.fn(), identify: jest.fn() };
```

### Gate 5 — Web Vitest (7 failing → 0)

| Test | Root Cause | Fix |
|------|-----------|-----|
| `homepage > renders wordmark as h1` | Hero redesign: h1 text is now "The board is the product." not "Purechess" | Updated assertion to `name: /the board is/i` |
| `homepage > renders tagline` | Tagline copy changed | Updated assertion to `/no puzzles, no lessons/i` |
| `profile > links each row to /games/:id` | `RecentGames` renders a "See all →" link alongside game links; `getByRole('link')` found multiple | Changed to `getAllByRole('link')` and filtered by href |
| `settings > board theme radio changes store` | Board theme uses `<button aria-pressed>` (not `<input type="radio">`) | Updated test to `getByRole('button', { name: /mono/i })` |
| `settings > lowTimeSound switch disabled` | `<Switch>` had no accessible name (label not connected via `htmlFor`) | Added `aria-label="Low-time tick"` to switch in `settings-form.tsx` |
| `settings > animations toggle updates store` | Same missing accessible name | Added `aria-label="Animations"` to switch |
| `settings > prefers-reduced-motion disables switch` | (a) Same missing accessible name; (b) hint text "Overridden by your system's reduced-motion setting." contained a curly apostrophe causing esbuild parse error; (c) hint text didn't contain "prefers-reduced-motion" | Fixed curly quotes → straight ASCII; updated hint to "Disabled by the prefers-reduced-motion OS setting."; updated test matcher |

---

## Files Changed

### Deleted
- `apps/api/test/computer-games/stockfish.service.spec.ts` — stale spec for deleted service

### Modified — API source/tests
- `apps/api/test/auth/auth.controller.spec.ts` — `PosthogService` mock + corrected `/me` assertion
- `apps/api/test/auth/auth.service.spec.ts` — `PosthogService` mock
- `apps/api/test/invites/invites.service.spec.ts` — `PosthogService` mock
- `apps/api/test/reports/reports.service.spec.ts` — `PosthogService` mock

### Modified — Web source
- `apps/web/src/components/admin/admin-page-header.tsx` — `description?: ReactNode`
- `apps/web/src/components/admin/games-table.tsx` — `Th` children optional
- `apps/web/src/components/admin/reports-table.tsx` — `Th` children optional
- `apps/web/src/components/home/footer.tsx` — inline SVG icons for GitHub + X
- `apps/web/src/components/settings/settings-form.tsx` — `aria-label` on switches; fixed curly-quote parse error; updated reduced-motion hint text

### Modified — Web tests
- `apps/web/test/home/homepage.test.tsx` — updated h1 name + tagline assertions
- `apps/web/test/profile/profile-page.test.tsx` — `getAllByRole` with href filter
- `apps/web/test/settings/settings-dialog.test.tsx` — board theme button query; updated reduced-motion text matcher

### Modified — Root
- `package.json` — added `"eslint": "^9.0.0"` to `devDependencies`
- `pnpm-lock.yaml` — updated lockfile

---

## Architecture Confirmation (for UI Epic)

### Route Table (from Session 02)

| Method | Route | Body | Returns | Status |
|--------|-------|------|---------|--------|
| POST | `/computer-games` | `CreateComputerGameDto` | `ComputerGameStateDto` | 201 |
| POST | `/computer-games/from-fen` | `CreateFromFenDto` | `ComputerGameStateDto` | 201 |
| POST | `/computer-games/:id/move` | `ComputerMoveDto` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/takeback` | `TakebackDto {plies:1\|2}` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/rewind` | `RewindToPlyDto {ply}` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/abort` | `AbortDto {reason?}` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/draw` | `DrawActionDto {action}` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/rematch` | `RematchDto {swapColors?}` | `ComputerGameStateDto` | 201 |
| GET | `/computer-games/:id` | — | `ComputerGameStateDto` | 200 |

### Engine Client API (from Session 03 — `apps/web/src/lib/engine/stockfish-client.ts`)

```ts
export function analyze(fen: string, options?: EngineAnalysisOptions): Promise<EngineEval>
export function getHint(fen: string, level: number): Promise<string>
export function getHumanMove(fen: string, options?: EngineAnalysisOptions): Promise<string>
export function getBestMove(fen: string, level: number, movetimeMs?: number): Promise<string>
export function cancel(): void
export function warmUp(): Promise<void>
export class EngineTimeoutError extends Error {}
export class EngineCancelledError extends Error {}
```

### Data Layer Wrappers (from Session 04 — `apps/web/src/lib/api/computer-games.ts`)

```ts
export function takebackComputerMove(gameId: string, plies: 1 | 2): Promise<ComputerGameStateDto>
export function rewindComputerGame(gameId: string, ply: number): Promise<ComputerGameStateDto>
export function abortComputerGame(gameId: string): Promise<ComputerGameStateDto>
export function drawComputerGame(gameId: string, action: DrawActionDto['action']): Promise<ComputerGameStateDto>
export function rematchComputerGame(gameId: string, swapColors?: boolean): Promise<ComputerGameStateDto>
export function createComputerGameFromFen(payload: CreateFromFenDto): Promise<ComputerGameStateDto>
```

---

## Open Risks / Notes

- The root `eslint.config.js` uses ESLint v9 flat-config API. `apps/web` still depends on
  `eslint@^8.57.0` (via `eslint-config-next`). The two coexist because `apps/web` runs
  `next lint` (uses its own eslint) while shared/api use the root v9 binary. No conflict in
  practice, but a cleanup to migrate `apps/web` to eslint v9 would simplify the setup.
- `apps/web/package.json` does not declare `"type": "module"` — produces a Node.js deprecation
  warning during `next lint`. Pre-existing; harmless but noisy.
- E2E tests (Playwright) are out of scope — they require a running API + database.
