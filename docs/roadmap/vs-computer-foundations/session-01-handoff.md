# Session 01 Handoff — vs-computer Contracts Charter

**Scope delivered:** Single source-of-truth TypeScript contracts in `@purechess/shared`.
Types + DTOs only — no endpoint logic, no UI logic, no service edits. Sessions 02 (API),
03 (engine client), 04 (web data layer) build against these in parallel.

## Files changed / created

- **Modified** `packages/shared/src/dto/computer-game.dto.ts` — extended
  `CreateComputerGameDto` + `ComputerGameStateDto`; added `ComputerClockDto` + 6 request DTOs.
- **Created** `packages/shared/src/dto/engine-analysis.dto.ts` — `EngineEval`,
  `EngineAnalysisOptions`.
- **Modified** `packages/shared/src/index.ts` — added
  `export * from './dto/engine-analysis.dto.js';` (computer-game.dto already exported).
- **Created** `docs/claude-sessions/vs-computer-foundations/.epic-produces-overrides.json`
  — empty override set (no downstream produces moved/satisfied).
- **Created** this handoff.

## Key decisions + rationale

1. **Plain interfaces, NO class-validator.** The session task said "use class-validator
   decorators matching existing DTO style" — self-contradictory: the existing shared style
   has **zero** decorators. `packages/shared/package.json` has no runtime deps (only
   `typescript` devDep) and all current DTOs (`game.dto`, `matchmaking.dto`,
   `computer-game.dto`) are decorator-free interfaces. **Kept plain interfaces** so shared
   stays dependency-free and bare-`tsc` buildable. **Runtime validation is the API layer's
   job (Session 02)** — wrap these as NestJS validation classes there if desired.

2. **Every NEW `ComputerGameStateDto` field is optional (`?:`).** This session cannot edit
   `apps/api/src/computer-games/computer-games.service.ts` (`toStateDto` builds the literal).
   Optional fields keep `pnpm -r typecheck` green for api. **Session 02 populates them** when
   it rewrites the service.

3. **Clock DTO uses `number`, never `bigint`.** Mirrors `engine/clock.ts` `serializeClock()`
   wire form (`{ whiteMs, blackMs, lastTickAt, incrementMs }`). `bigint` is not JSON-safe.

4. **Reuse `GameTermination` / `GameResult` — no new enums.** Mapping for Session 02:
   - abort → `GameTermination.Abandonment`
   - draw by agreement → `GameTermination.DrawAgreement`
   - draw claim → `GameTermination.ThreefoldRepetition` / `FiftyMoveRule` / `Stalemate`
   - draw result → `GameResult.Draw`

5. **`result` / `resultReason` stay `string | null` on the DTO.** Current service literal
   writes raw strings; tightening to enums would break the api typecheck. Enum mapping above
   is for Session 02 to apply server-side. (No enum import left in the DTO file — it would be
   an unused import and fail lint.)

## Exact shapes (copy/paste truth)

### `computer-game.dto.ts`

```ts
export interface CreateComputerGameDto {
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  color: 'white' | 'black' | 'random';
  timeControlSeconds: number;
  incrementSeconds?: number;
  eloTarget?: number;        // UCI_Elo target (Session 03 strength mode)
  thinkTimeMs?: number;      // engine movetime per move (ms)
  styleBlunderCp?: number;   // ± centipawn window for human-like play
}

export interface ComputerMoveDto {
  move: string;              // UCI, or "resign"
}

export interface ComputerClockDto {
  whiteMs: number;
  blackMs: number;
  lastTickAt: number;        // epoch ms of last tick
  incrementMs?: number;
}

export interface ComputerGameStateDto {
  gameId: string;
  fen: string;
  pgn: string;
  status: string;            // 'active' | 'completed' | 'aborted'
  computerColor: 'white' | 'black';
  computerLevel: number;
  lastComputerMove: string | null;
  result: string | null;
  resultReason: string | null;
  // NEW — all OPTIONAL; Session 02 populates
  clock?: ComputerClockDto | null;
  drawOffered?: boolean;
  drawOfferedBy?: 'white' | 'black' | null;
  abortable?: boolean;       // true iff zero player moves made
}

export interface TakebackDto    { plies: 1 | 2; }          // 1 = undo human; 2 = undo human + bot reply
export interface RewindToPlyDto { ply: number; }           // truncate to this ply (>= 0)
export interface AbortDto       { reason?: string; }
export interface DrawActionDto  { action: 'offer' | 'accept' | 'decline' | 'claim'; }
export interface RematchDto     { swapColors?: boolean; }
export interface CreateFromFenDto extends CreateComputerGameDto { fen: string; }
```

### `engine-analysis.dto.ts`

```ts
export interface EngineEval {
  cp?: number;        // centipawn, side-to-move POV; absent if mate
  mate?: number;      // moves-to-mate; absent if cp
  depth: number;
  bestmove: string;   // UCI
  pv: string[];       // principal variation (UCI)
}

export interface EngineAnalysisOptions {
  movetimeMs?: number;
  multiPv?: number;          // 1-3
  eloTarget?: number;        // UCI_LimitStrength + UCI_Elo
  skill?: number;            // UCI Skill Level 0-20
  blunderCp?: number;        // style knob window
  deterministicSeed?: number;
}
```

### `index.ts`
Added: `export * from './dto/engine-analysis.dto.js';`

## Signatures downstream sessions MUST implement

### Session 02 — API endpoints (NestJS, `computer-games.controller.ts` + service)

| Method | Route | Body | Returns | Status |
|---|---|---|---|---|
| POST | `/computer-games/:id/takeback` | `TakebackDto` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/rewind`   | `RewindToPlyDto` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/abort`    | `AbortDto` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/draw`     | `DrawActionDto` | `ComputerGameStateDto` | 200 |
| POST | `/computer-games/:id/rematch`  | `RematchDto` | `ComputerGameStateDto` | 201 |
| POST | `/computer-games/from-fen`     | `CreateFromFenDto` | `ComputerGameStateDto` | 201 |

Plus: clock-aware `submitMove` must populate `clock` on the returned `ComputerGameStateDto`.

Session 02 owns:
- Prisma **migration** for `status='aborted'` + `drawOfferedBy` column.
- Reuse existing `engineStateSnapshot` column (migration
  `20260607140000_computer_game_engine_state`) for rewind/undo state.
- **bug-005 guard:** `applyMove` (chess/engine/game-state.ts) can early-return on
  flag-fall/timeout WITHOUT appending a move — check `state.moves.length` grew before writing
  a `Move` row.
- **`Move` has UNIQUE `(gameId, ply)`** — takeback/rewind must DELETE rows, not re-insert
  over a collision.
- Apply the enum mapping (decision 4) when persisting draw/abort results.

### Session 03 — engine client (`apps/web/src/lib/engine/stockfish-client.ts`)

```ts
analyze(fen: string, options?: EngineAnalysisOptions): Promise<EngineEval>
getHint(fen: string, level: number): Promise<string>           // UCI
cancel(): void
warmUp(): Promise<void>
// keep backward-compatible:
getBestMove(fen: string, level: number, movetimeMs?: number): Promise<string>
```
Plus a typed `EngineTimeoutError`. Stockfish stays **client-side in the Web Worker** — no
server engine.

### Session 04 — web data layer (match existing `apiFetch` style in
`apps/web/src/lib/api/computer-games.ts`)

```ts
takebackComputerMove(gameId: string, plies: 1 | 2): Promise<ComputerGameStateDto>
rewindComputerGame(gameId: string, ply: number): Promise<ComputerGameStateDto>
abortComputerGame(gameId: string): Promise<ComputerGameStateDto>
drawComputerGame(gameId: string, action: DrawActionDto['action']): Promise<ComputerGameStateDto>
rematchComputerGame(gameId: string, swapColors?: boolean): Promise<ComputerGameStateDto>
createComputerGameFromFen(payload: CreateFromFenDto): Promise<ComputerGameStateDto>
```

## Quality gates — results

- `pnpm --filter @purechess/shared build` → **PASS**.
- `pnpm -r typecheck` → shared **PASS**, api **PASS** (after `pnpm --filter @purechess/api
  db:generate`; Prisma client was not generated in the fresh worktree).
  - **web typecheck fails on PRE-EXISTING errors unrelated to this session**
    (`lucide-react` missing `Github`/`Twitter` exports, admin table `children` props,
    `admin/reports/[id]/page.tsx` Element-vs-string). Verified via `git stash` of
    `packages/shared`: identical web errors with my changes removed. Not introduced here;
    flagged for repo owners.
- Lint → **PASS** on changed files. Note: `eslint` has no bin linked in
  `node_modules/.bin` in this worktree (only a transitive `eslint@8.57.1` in the pnpm store);
  ran via `node node_modules/.pnpm/eslint@8.57.1/node_modules/eslint/bin/eslint.js <files>`
  → exit 0, zero findings. The `pnpm -r lint` script (`eslint src`) currently can't resolve
  the binary — repo-setup gap, not a code issue.

## Open risks / notes for downstream

- web typecheck is red on pre-existing errors (above) — Session 04 should not be blamed for
  them, but may want to flag/fix `lucide-react` + admin-table issues if they touch those.
- `eslint` binary not wired in the worktree — Session 05 (CI gate) should ensure `eslint` is
  a declared dependency so `pnpm -r lint` resolves.
- `.epic-produces-overrides.json` written with an empty override set — no downstream
  produces relocated or pre-satisfied.
