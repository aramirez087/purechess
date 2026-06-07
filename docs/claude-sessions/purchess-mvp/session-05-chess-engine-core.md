---
depends_on: [02]
touches:
  - "apps/api/src/chess/**"
  - "apps/api/src/chess/chess.module.ts"
  - "apps/api/src/chess/engine/**"
  - "apps/api/src/chess/engine/move-validator.ts"
  - "apps/api/src/chess/engine/game-state.ts"
  - "apps/api/src/chess/engine/clock.ts"
  - "apps/api/src/chess/engine/result-detector.ts"
  - "apps/api/src/chess/engine/pgn-builder.ts"
  - "apps/api/src/chess/engine/fen-utils.ts"
  - "apps/api/test/chess/**"
  - "packages/shared/src/chess.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 05: Chess Engine Core (Server)

## Mission

Build the **server-authoritative chess engine**. This is the brain of Purchess: it owns the game state, validates moves, manages clocks, and detects results. Every other gameplay module (`GameService`, `MatchmakingService`, `GameGateway`) consumes it.

Critical constraint: **the server never trusts the client**. Every move, clock update, and result is recomputed here.

## Tasks

1. **Library choice**:
   - Use `chess.js` for move generation and SAN/UCI conversion (battle-tested, fast, lightweight).
   - Wrap it in our own engine module to enforce invariants: immutable game state, clock integration, explicit result detection.
2. **Engine module** (`apps/api/src/chess/engine/`):
   - `move-validator.ts` — `validateMove(state, move): { ok: true, newState } | { ok: false, reason }`. Validates SAN, UCI, turn, legality, check, promotion choice. Rejects premoves that would leave own king in check after opponent's response (server still tracks raw premoves for client convenience but the authoritative check is on commit).
   - `game-state.ts` — pure functions: `createGame({ whiteId, blackId, timeControl, increment })` returns `EngineState`. `applyMove(state, move)` returns new `EngineState` or throws. `unmakeMove(state)` for takeback support (used by clock editor in tests). State is structurally shared, never mutated in place.
   - `clock.ts` — `tickClock(state, nowMs)` returns state with `whiteMs`/`blackMs` decremented for the side to move. `applyIncrement(state, side)` adds increment after a move. `isTimeout(state, nowMs)`. `serializeClock(state)` for client snapshots. **All time math uses `BigInt` internally to avoid drift over long games; serialized to `Int` ms for wire/DB.**
   - `result-detector.ts` — given a position and the side that just moved, returns `null | { result: GameResult, reason: GameResultReason }`. Reasons: `checkmate`, `stalemate`, `insufficient_material`, `threefold_repetition`, `fifty_move_rule`, `timeout`, `resignation`, `draw_agreement`, `abandoned`.
   - `pgn-builder.ts` — `buildPgn(moves, headers)` returns PGN string with required headers (`Event`, `Site`, `Date`, `White`, `Black`, `Result`, `TimeControl`, `ECO`?, `WhiteElo`?, `BlackElo`?).
   - `fen-utils.ts` — `startingFen()`, `parseFen`, `toFen(state)`, helpers for FEN round-trips.
3. **EngineState shape**:
   ```ts
   type EngineState = {
     gameId: string;
     whiteUserId: string | null;     // null for anonymous vs anon
     blackUserId: string | null;
     position: Chess;                 // chess.js instance, immutable via replace
     fenHistory: string[];            // for threefold detection
     moves: EngineMove[];             // committed moves with SAN, UCI, fen, clockAfter, moveTimeMs
     pendingDrawOfferBy: Color | null;
     clock: {
       whiteMs: number;
       blackMs: number;
       lastTickAt: number;            // server epoch ms
       incrementMs: number;
     };
     status: 'pending' | 'active' | 'completed' | 'aborted';
     result: GameResult | null;
     resultReason: GameResultReason | null;
   };
   ```
4. **Time control enforcement**:
   - On `applyMove`, the new `EngineState` reflects post-move clocks (decrement + increment).
   - Server is the only writer of `lastTickAt`; clients send move intents, server stamps the move time as `now - lastTickAt` for the side that moved.
   - `tickClock` is called before every move validation so timeout is always evaluated against the freshest server time.
5. **Threefold + 50-move detection**:
   - `position` itself doesn't track repetition; the engine maintains `fenHistory` and detects on every `applyMove` (and on `tickClock` for the side that can't move).
   - 50-move rule: chess.js exposes `isInsufficientMaterial`, `isDraw`, and `isThreefoldRepetition` but not raw counters. Track `halfmoveClock` and `fullmoveNumber` ourselves from chess.js internals or by diffing FENs.
6. **Pure-function discipline**:
   - All public APIs are pure: `applyMove(state, ...) → newState`. Internal mutation of `chess.js` is performed via a deep clone or by replacing the `Chess` instance with a serialized-then-rehydrated one.
   - This makes the engine trivial to snapshot to Redis and to unit-test.
7. **Shared types** (`packages/shared/src/chess.ts`):
   - `Color`, `Piece`, `Square`, `Move`, `GameResult`, `GameResultReason`, `EngineState` (serializable form, no `Chess` instance).
   - Wire format: `WireMove = { ply, san, uci, fenAfter, clockAfterMs, moveTimeMs, by: Color }`.
8. **Tests** (`apps/api/test/chess/`):
   - Move validation: legal, illegal, wrong turn, promotion without piece choice, castling through check, en passant pinned, double check.
   - Clock: increment applied correctly, timeout detection at exactly 0, lag compensation (server never trusts client timestamps).
   - Result: checkmate, stalemate, insufficient material (KvK, KvK+B, KvK+N), threefold (set up repeated position), 50-move.
   - PGN: round-trip parse, headers correct, move list correctly numbered.
   - FEN: starting position round-trips; per-move FENs match chess.js.
   - Determinism: same move sequence produces same state hash from any starting point.
9. **Verification**:
   - `pnpm --filter @purchess/api test chess` all green.
   - Coverage ≥ 90% on `engine/`.
   - Engine is importable from `GameService` (Session 08) without circular deps.

## Deliverables

- `ChessEngineModule` providing `EngineService` (or pure functions) with the API above.
- `EngineState` is fully serializable to JSON for Redis storage.
- PGN output matches PGN spec for export.
- Test suite with deterministic seed and known-fixture replays.

## Notes for Downstream Sessions

- `GameService` (Session 08) is the only consumer. Do not call engine functions from controllers.
- The WebSocket payload for a state snapshot uses the **wire format** above — no `chess.js` types leak to the client.
- For the client, the web app will use `chess.js` for its own move preview only. The client never authors game state.
- Premove handling lives in the **client** (Session 12) — server tracks committed moves only.
- Promotion: server requires the promotion piece in the move intent (e.g., `uci = "e7e8q"`). Reject if missing or invalid.
