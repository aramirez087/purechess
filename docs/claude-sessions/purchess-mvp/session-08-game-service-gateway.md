---
depends_on: [05, 06]
touches:
  - "apps/api/src/games/**"
  - "apps/api/src/games/games.module.ts"
  - "apps/api/src/games/games.service.ts"
  - "apps/api/src/games/games.gateway.ts"
  - "apps/api/src/games/dto/**"
  - "apps/api/src/games/game-state.repository.ts"
  - "apps/api/src/games/clock-scheduler.service.ts"
  - "apps/api/test/games/**"
  - "packages/shared/src/game-events.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 08: Game Service & Gateway

## Mission

Wire the chess engine (Session 05) and realtime layer (Session 06) into the live game loop. `GamesService` owns the lifecycle of every active game: it hydrates state from Redis, validates moves, persists to Postgres on completion, and emits the right WebSocket events. `GamesGateway` is the WebSocket surface that the client uses to play.

This is where Purchess actually becomes a chess game.

## Tasks

1. **GamesModule** (`apps/api/src/games/`):
   - `games.service.ts` — orchestrates engine + repository + persistence.
   - `games.gateway.ts` — Socket.IO gateway on `/realtime`, namespace `/games` (or reused — pick one and document).
   - `game-state.repository.ts` — Redis adapter for active `EngineState`.
   - `clock-scheduler.service.ts` — periodic tick that detects timeouts.
   - `dto/` — wire payload DTOs.
2. **State repository** (`game-state.repository.ts`):
   - `load(gameId): Promise<EngineState | null>`.
   - `save(state): Promise<void>` (with TTL = max(remaining clock ms + 1h, 6h)).
   - `delete(gameId)`.
   - Key: `game:state:<gameId>`. Stored as JSON-serialized `EngineState`.
   - Includes a `version` integer incremented on every save for optimistic concurrency.
3. **Clock scheduler**:
   - In-process `setInterval` (1s tick) that scans active games whose `lastTickAt + clock` is in the past.
   - On timeout: emit `game:timeout` via gateway, persist result with reason `timeout`.
   - For multi-instance correctness, the scheduler uses Redis `SET NX EX` to claim a game before processing (one instance wins per tick).
4. **Game lifecycle in `GamesService`**:
   - `createGame({ whiteId, blackId, timeControl, increment, isRated, category, inviteToken? })`:
     1. Insert `Game` row in Postgres with `status = 'pending'`.
     2. Build `EngineState` via Session 05.
     3. Save to Redis.
     4. Return game.
   - `startGame(gameId)` — set `status = 'active'`, set `startedAt`, push state to both players via `user:<id>` and `game:<id>` rooms.
   - `applyMove(gameId, userId, moveIntent)`:
     1. Load state.
     2. Reject if it's not `userId`'s turn.
     3. `validateMove` (Session 05).
     4. Reject if move illegal.
     5. `applyMove` engine function.
     6. `tickClock` first to consume elapsed time.
     7. Compute `moveTimeMs = now - lastTickAt` for the mover.
     8. Append `EngineMove` to `state.moves`.
     9. Check for result (checkmate, stalemate, etc.).
     10. If game over → `completeGame(state, result, reason)`.
     11. Save state to Redis (with version check).
     12. Broadcast `game:state` to `game:<id>`.
   - `offerDraw(gameId, userId)` — sets `pendingDrawOfferBy`. Broadcasts `game:draw-offer`.
   - `acceptDraw(gameId, userId)` — only valid if the other side offered. Completes with `draw_agreement`.
   - `declineDraw(gameId, userId)` — clears `pendingDrawOfferBy`.
   - `resign(gameId, userId)` — completes with `resignation` for the opponent.
   - `requestAbort(gameId, userId)` — for casual games; completes with `abandoned` if both sides agree or the second player has not joined within 60s.
   - `reconnect(gameId, userId)` — returns the current snapshot. Used by the gateway on `reconnect:game`.
5. **`GamesGateway` events** (under `/realtime`):
   - Inbound (client → server):
     - `game:join` `{ gameId }` → server adds socket to `game:<id>` room, returns snapshot.
     - `game:move` `{ gameId, uci, promotion? }` → calls `applyMove`, returns ack with new state and move number.
     - `game:resign` `{ gameId }`.
     - `game:draw-offer` `{ gameId }`.
     - `game:draw-accept` `{ gameId }`.
     - `game:draw-decline` `{ gameId }`.
   - Outbound (server → client):
     - `game:state` `{ fen, moves, clocks, status, result?, turn }` — full snapshot after every move.
     - `game:move-made` `{ ply, san, uci, by, clockAfterMs, moveTimeMs }` — granular event for animations.
     - `game:result` `{ result, reason, ratingChange? }` — once.
     - `game:draw-offered` `{ by }`.
     - `game:error` `{ code, message }` — per ack failure.
6. **Anonymous support**:
   - `createGame` accepts `null` for whiteId or blackId. Server tracks a generated `anon:<shortId>` placeholder and excludes these from rating (isRated=false only).
   - Anonymous games still use the engine, clocks, and result detection.
7. **Reconnection grace**:
   - On socket disconnect during active game, `GamesService` does **not** end the game. Marks the user as `disconnected` in state with a 60s grace timer. If they don't reconnect, the opponent is offered a win (configurable; for MVP, just play on and let time handle it; the player can rejoin on another device).
   - On reconnect, snapshot is sent and the disconnected flag is cleared.
8. **Result completion** (`completeGame`):
   - Compute rating changes (delegated to `RatingsService` in Session 10).
   - Build PGN (Session 05).
   - Persist `Game` (final), `Move[]`, and rating rows in a single Prisma transaction.
   - Delete Redis state.
   - Broadcast `game:result`.
9. **Shared event types** (`packages/shared/src/game-events.ts`):
   - Typed payloads for every event above. Importable by client and server.
10. **Tests** (`apps/api/test/games/`):
    - Move validation round-trip: legal accepted, illegal rejected, wrong turn rejected, promotion piece required.
    - Clock: increment applied; timeout detected and game ends with reason `timeout`; slow client cannot gain time by delaying.
    - Draw flow: offer, accept → draw; offer, decline → continues.
    - Resign: opponent wins.
    - Stalemate: detected from a constructed position.
    - Anonymous: anon + anon game ends correctly; anon + authed casual game ends correctly; anon + authed rated rejected.
    - Reconnect: client gets current snapshot; rejoining clears disconnected flag.
    - Persistence: completed game appears in DB with correct PGN, moves, ratings.
11. **Verification**:
    - End-to-end: two socket clients play a 5+0 game; on mate, both receive `game:result` and the DB has a complete record.
    - Crash recovery: kill the API mid-game, restart, snapshot hydrates from Redis.

## Deliverables

- `GamesService` and `GamesGateway` fully wired.
- Redis-backed active game state with versioned saves.
- Reconnect + draw + resign + timeout flows.
- Shared event payload types.
- Test suite covering all paths.

## Notes for Downstream Sessions

- `MatchmakingService` (Session 09) calls `GamesService.createGame` to instantiate matched games.
- `GamePersistenceService` (Session 11) is called from `completeGame` — the actual `Move[]` and PGN are produced by the engine (Session 05) and handed to the persistence layer.
- The client never sees `EngineState` directly; it only ever sees the wire payloads.
- Adding new event types: define in `packages/shared/src/game-events.ts` first, then implement on both sides.
- For load testing: a single instance should sustain 5,000 concurrent games comfortably with 1s tick. Profile before optimizing.
