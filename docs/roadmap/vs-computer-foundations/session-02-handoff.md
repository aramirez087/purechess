# Session 02 Handoff — vs-computer API endpoints

**Scope delivered:** Authoritative server endpoints for takeback, rewind, abort,
draw (offer/accept/decline/claim), rematch, and create-from-fen on the vs-computer
feature, plus clock-aware `submitMove`. Built against the contracts from
`session-01-handoff.md`. All logic lives in the (ungated) `computer-games` services —
no `chess/engine/**` changes.

## Files created / modified

### Created
- `apps/api/src/computer-games/computer-game-actions.service.ts` —
  `ComputerGameActionsService`: `takeback`, `rewind`, `abort`, `draw`, `rematch`.
- `apps/api/src/computer-games/computer-games.helpers.ts` — shared helpers:
  `STARTING_FEN`, `resolveColor`, `getCategory`, `fenPositionKey`, `computeExtras`,
  `buildStateDto`, `truncateToPly`, plus `DtoExtras`/`BuildStateDtoArgs` types.
- `apps/api/test/computer-games/computer-game-actions.service.spec.ts` — full spec
  for the new service (24 cases).

### Modified
- `apps/api/src/computer-games/computer-games.service.ts` — dropped the local
  `STARTING_FEN`/`resolveColor`/`getCategory`/`toStateDto` (now imported from
  helpers); all returns go through `buildStateDto` + `computeExtras`; clock-aware
  `submitMove`; new `createGameFromFen`.
- `apps/api/src/computer-games/computer-games.controller.ts` — injected
  `ComputerGameActionsService`; added 6 routes.
- `apps/api/src/computer-games/computer-games.module.ts` — registered
  `ComputerGameActionsService` provider.
- `apps/api/test/computer-games/computer-games.service.spec.ts` — added clock-aware
  `submitMove` cases (timed tick, timed flag-fall/bug-005, untimed reset) and
  `createGameFromFen` (valid + invalid FEN).

### NOT changed (deliberate)
- `apps/api/prisma/schema.prisma` + migrations — **no migration needed** (see below).
- `packages/shared/**` — DTOs finalized in Session 01.
- `apps/api/src/chess/engine/**` — untouched; coverage gate stays green.

## Decision: NO Prisma migration this session (overrides Session-01 "owns migration")

Verified against `schema.prisma`:
- `enum GameStatus` already has `aborted` — `status:"aborted"` works (existing code
  already writes string literals against this enum).
- `enum GameResultReason` already has `stalemate`, `threefold_repetition`,
  `fifty_move_rule`, `insufficient_material`, `draw_agreement`, `abandonment`.
- **No `drawOfferedBy` column needed:** `SerializableEngineState.pendingDrawOfferBy`
  (`'w'|'b'|null`) is serialized into the existing `Game.engineState Json?` column and
  survives round-trips. `drawOffered`/`drawOfferedBy` on the DTO are derived from it.
- The snapshot column is `Game.engineState` (NOT `engineStateSnapshot` — that name does
  not exist; migration `20260607140000_computer_game_engine_state` adds `engineState`).
  Reused for rewind/undo state.

## Route table (final) — source of truth

| Method | Route | Body DTO | Returns | Status | Handler |
|---|---|---|---|---|---|
| POST | `/computer-games` | `CreateComputerGameDto` | `ComputerGameStateDto` | 201 | `service.createGame` |
| POST | `/computer-games/from-fen` | `CreateFromFenDto` | `ComputerGameStateDto` | 201 | `service.createGameFromFen` |
| POST | `/computer-games/:id/move` | `ComputerMoveDto` | `ComputerGameStateDto` | 200 | `service.submitMove` |
| POST | `/computer-games/:id/takeback` | `TakebackDto {plies:1\|2}` | `ComputerGameStateDto` | 200 | `actions.takeback` |
| POST | `/computer-games/:id/rewind` | `RewindToPlyDto {ply}` | `ComputerGameStateDto` | 200 | `actions.rewind` |
| POST | `/computer-games/:id/abort` | `AbortDto {reason?}` | `ComputerGameStateDto` | 200 | `actions.abort` |
| POST | `/computer-games/:id/draw` | `DrawActionDto {action}` | `ComputerGameStateDto` | 200 | `actions.draw` |
| POST | `/computer-games/:id/rematch` | `RematchDto {swapColors?}` | `ComputerGameStateDto` | 201 | `actions.rematch` |
| GET | `/computer-games/:id` | — | `ComputerGameStateDto` | 200 | `service.getGame` |

Guard: `OptionalSessionAuthGuard` + `@CurrentUser()` on every route (unchanged style).

### Error codes (all server-validated)
- **404** `NotFoundException` — game id not found.
- **400** `BadRequestException` — not a computer game; engine state missing; game not
  active (abort/draw on completed/aborted); takeback with no moves ("Nothing to take
  back"); rewind ply out of range (`<0` or `>= moves.length`, "Ply out of range");
  abort after a human move ("Cannot abort after a move"); draw accept with no pending
  offer ("No draw offer to accept"); draw claim with no detectable draw ("No draw to
  claim"); invalid FEN ("Invalid FEN").
- **403** `ForbiddenException` — user is neither player.

## Behavior notes (for Session 04 web layer + reviewers)

- **`ComputerGameStateDto` now always carries the optional fields** (`clock`,
  `drawOffered`, `drawOfferedBy`, `abortable`) on every endpoint incl. `getGame`.
  - `clock` = serialized engine clock (`{whiteMs,blackMs,lastTickAt,incrementMs}`),
    numbers (never bigint); `null` if no clock present.
  - `drawOfferedBy` = `'white'|'black'|null` mapped from engine `'w'|'b'|null`.
  - `abortable` = `status==='active' && humanMovesPlayed===0`.
- **Takeback semantics:** `targetPly = moves.length - plies`; `plies:1` removes the
  trailing ply, `plies:2` removes human move + bot reply. Rejects `targetPly < 0`.
- **Rewind semantics:** `ply` = target length to keep. Allowed `0 <= ply < moves.length`
  (ply 0 → starting position). `ply === moves.length` is rejected as out of range
  (tighter contract — no no-op).
- **`(gameId, ply)` integrity:** takeback + rewind run a `prisma.$transaction` that
  `deleteMany({ where: { gameId, ply: { gt: targetPly } } })` then updates the game.
  **Never re-inserts** over the unique constraint. State after truncation is rebuilt
  from each surviving move's `fenAfter`/`clockAfterMs` (`truncateToPly`) — no replay,
  so no chess.js re-execution and no engine-dir dependency.
- **Takeback/rewind reopen a completed game:** they set `status:'active'`, clear
  `result`/`resultReason`/`endedAt` so a checkmate/timeout can be undone. Abort and
  draw are blocked on non-active games.
- **Abort:** allowed only when zero *human* moves played (a lone computer first move is
  fine). Sets `status:'aborted'`, leaves `result`/`resultReason` null (aborted is a
  distinct status, not a `completed` result; games are unrated → no rating impact).
- **Draw mapping:** accept → `result=draw`, `resultReason=draw_agreement`; claim →
  uses `engine.detectResult`, honoured only if it returns a `Draw` (stalemate /
  threefold_repetition / fifty_move_rule / insufficient_material). offer/decline keep
  the game active and only mutate `pendingDrawOfferBy`.
- **Rematch:** reuses `level`, `timeControlSeconds`, `incrementSeconds`; human color =
  original human color, flipped when `swapColors`. Delegates to
  `ComputerGamesService.createGame` (returns a NEW `gameId`, 201).
- **Create-from-fen:** validates with `new Chess(fen)` (throws → 400); persists
  `startingFen=finalFen=normalizedFen` and an `engineState` literal with `moves:[]`,
  `fenHistory:[fenPositionKey(fen)]`. Note: chess.js **normalizes** the FEN (e.g. drops
  an en-passant target square when no capture is possible) — `result.fen` is the
  normalized form, not necessarily the exact input.
- **Clock-aware `submitMove`:** for `timeControlSeconds > 0` the persisted `lastTickAt`
  is kept so `applyMove` ticks real elapsed, applies increment, and flag-fall can fire.
  For `timeControlSeconds <= 0` (untimed) `lastTickAt` is reset to now so `isTimeout`
  never fires (byte-identical to old behavior). bug-005 guard
  (`state.moves.length === engineState.moves.length`) handles flag-fall on the timed
  path with no `Move` row and no 500.

## New signatures (for Session 04 — already match Session-01's promised client API)

```ts
// ComputerGamesService
createGameFromFen(userId: string | null, dto: CreateFromFenDto): Promise<ComputerGameStateDto>

// ComputerGameActionsService
takeback(gameId: string, userId: string | null, plies: 1 | 2): Promise<ComputerGameStateDto>
rewind(gameId: string, userId: string | null, ply: number): Promise<ComputerGameStateDto>
abort(gameId: string, userId: string | null): Promise<ComputerGameStateDto>
draw(gameId: string, userId: string | null, action: 'offer'|'accept'|'decline'|'claim'): Promise<ComputerGameStateDto>
rematch(gameId: string, userId: string | null, swapColors?: boolean): Promise<ComputerGameStateDto>
```

## Quality gates — results

- `pnpm --filter @purechess/shared build` → **PASS**.
- `cd apps/api && pnpm typecheck` → **PASS** (after `db:generate` for the fresh worktree).
- Lint (changed files) → **PASS, 0 findings**. `pnpm -r lint`/`pnpm lint` still cannot
  resolve the `eslint` bin in this worktree (pre-existing repo-setup gap, see Session 01);
  ran `node node_modules/.pnpm/eslint@8.57.1/node_modules/eslint/bin/eslint.js <files>`.
- Tests (touched scope): `test/computer-games/computer-games.service.spec.ts` +
  `computer-game-actions.service.spec.ts` + `test/chess/**` → **111 pass, 0 fail**.
- Engine coverage gate (`src/chess/engine/`) → **PASS**: 96.31% stmts / 87.67% branch /
  100% funcs / 96.27% lines (thresholds 90/90/85), jest exit 0. No engine files touched.

### Pre-existing failures (NOT introduced here — verified via `git stash`)
The fresh worktree has 4 suites failing at baseline (HEAD without my changes), plus
`test/computer-games/stockfish.service.spec.ts`: `test/auth/auth.controller.spec.ts`,
`test/auth/auth.service.spec.ts`, `test/invites/invites.service.spec.ts`,
`test/reports/reports.service.spec.ts` — NestJS DI/Throttler resolution + env-dependent
failures unrelated to this session. `pnpm test` (full) is therefore red on these regardless;
the touched scope is fully green.

## Open risks / notes
- Existing computer games created with `timeControlSeconds > 0` are now genuinely timed
  (previously forced to ∞). If the web UI still presents them as "Unlimited", create
  them with `timeControlSeconds: 0`, or Session 04 should surface the clock and tick it.
- `eslint` bin not wired in the worktree — Session 05 (CI) should declare `eslint` so
  `pnpm -r lint` resolves.
