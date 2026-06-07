# Session 05 Handoff — Chess Engine Core

## What Was Built

### Engine Module (`apps/api/src/chess/engine/`)

Six pure-function modules, all TypeScript, no mutation:

| File | Purpose |
|------|---------|
| `fen-utils.ts` | `startingFen`, `fenPosition` (4-field key for threefold), `halfmoveClock`, `toFen` |
| `clock.ts` | BigInt clock: `makeClock`, `tickClock`, `applyIncrement`, `isTimeout`, `serializeClock` |
| `result-detector.ts` | `detectResult` — checks timeout, checkmate, stalemate, insufficient material, threefold, 50-move |
| `move-validator.ts` | `validateMove` — accepts UCI or from/to/promotion; handles promotion guard; delegates legality to chess.js |
| `game-state.ts` | `createGame`, `applyMove`, `unmakeMove`, `toSerializable`, `fromSerializable`; `EngineState` type; `InvalidMoveError` class |
| `pgn-builder.ts` | `buildPgn(moves, headers)` — produces spec-compliant PGN |
| `index.ts` | Re-exports all engine public API |

### NestJS Wrappers (`apps/api/src/chess/`)

- `engine.service.ts` — `@Injectable()` `EngineService` thin wrapper over pure functions; all state lives in caller-owned `EngineState` objects
- `chess.module.ts` — `ChessEngineModule` providing and exporting `EngineService`; no other module imports

### Shared Types (`packages/shared/src/chess.ts`)

Added:
- `GameResultReason` — type alias for `GameTermination`
- `EngineMove` — `{ ply, san, uci, fenAfter, clockAfterMs, moveTimeMs, by: Color }`
- `SerializableEngineState` — JSON-safe form of `EngineState` (no `Chess` instance; `fen: string`; clock as `number`)
- `WireMove` — wire format for client snapshots
- `MoveIntent` — `{ uci?, from?, to?, promotion? }`

### Key Design Decisions

- **BigInt clock math** — `ClockSnapshot` uses `bigint` internally; `serializeClock` converts to `number` for wire/DB
- **Chess.js immutability** — each `validateMove` call creates a fresh `Chess(chess.fen())` clone; no mutation
- **Threefold via fenHistory** — 4-field FEN keys (strips halfmove/fullmove); checked on every `applyMove`
- **Promotion guard** — `validateMove` explicitly rejects pawn reaching back rank without promotion piece before delegating to chess.js
- **Timeout detection order** — `isTimeout` checked before move validation in `applyMove`; `detectResult` checks timeout for side-to-move (handles real-time ticker use case too)
- **`unmakeMove`** — restores position and fenHistory from `moves` array; does NOT restore clock history (noted below as known gap)

## Verification Evidence

```
pnpm --filter @purechess/api test --coverage --testPathPattern="test/chess"
→ 6 test suites, 64 tests — all passed

Coverage src/chess/engine/:
  Statements: 96.31%
  Branches:   87.67%
  Functions:  100%
  Lines:      96.27%

pnpm --filter @purechess/api typecheck
→ 0 errors (chess engine files clean; 7 pre-existing @prisma/client errors
  in src/auth/ require `prisma generate` to resolve — fixed during this session
  by running db:generate)

pnpm --filter @purechess/shared typecheck
→ 0 errors
```

## Open Issues / Known Gaps

- **`unmakeMove` clock restoration** — restores position and moves but NOT the clock state. Caller must snapshot the clock before calling `unmakeMove` if precise clock restoration is needed. Acceptable for test/takeback use.
- **eslint not installed** — no eslint binary in the workspace. `pnpm lint` fails with `eslint: command not found`. Pre-existing gap from prior sessions. TypeScript typecheck serves as the code quality gate.
- **`EngineService.tickClock`** — updates the clock for the side to move (no move applied). Used by real-time tick process (session 08+). Returns a new `EngineState` with updated clock only.
- **Draw offers** — `pendingDrawOfferBy` field tracked on `EngineState` but no `offerDraw`/`acceptDraw` engine functions. `GameService` (session 08) sets this field directly.

## Inputs Downstream Sessions Can Rely On

### Paths
- `ChessEngineModule`: `apps/api/src/chess/chess.module.ts`
- `EngineService`: `apps/api/src/chess/engine.service.ts`
- `EngineState` (internal type): `apps/api/src/chess/engine/game-state.ts`
- Engine pure functions: `apps/api/src/chess/engine/` (each file or via `index.ts`)

### Exported Symbols from `@purechess/shared`
- `EngineMove`, `SerializableEngineState`, `WireMove`, `MoveIntent`, `GameResultReason`
- `GameResult` (enum), `GameTermination` (enum) — unchanged

### Importing `ChessEngineModule` (session 08)
```typescript
import { ChessEngineModule } from '../chess/chess.module';
// In GamesModule:
@Module({ imports: [ChessEngineModule], ... })
```

### Primary `EngineService` Call Path
```typescript
// throws InvalidMoveError on illegal move
const newState = engineService.applyMove(state, intent, Date.now());

// Redis snapshot
const serialized = engineService.toSerializable(newState);
const restored = engineService.fromSerializable(parsed);

// PGN export
const pgn = engineService.buildPgn(state.moves, { white, black, result: '1-0' });
```

### `InvalidMoveError`
```typescript
import { InvalidMoveError } from '../chess/engine.service';
// Catch in GameService to return 4xx WS error
try { ... } catch (e) {
  if (e instanceof InvalidMoveError) { /* return error event */ }
}
```

### Env Keys
No new env keys introduced.
