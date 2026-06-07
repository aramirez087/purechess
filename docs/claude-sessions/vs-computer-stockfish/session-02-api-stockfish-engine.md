---
session: 2
title: "API — StockfishService + ComputerGamesService + endpoints"
depends_on: [1]
touches:
  - apps/api/src/computer-games/**
parallel_safe: true
produces:
  - apps/api/src/computer-games/stockfish.service.ts
  - apps/api/src/computer-games/computer-games.service.ts
  - apps/api/src/computer-games/computer-games.controller.ts
  - apps/api/src/computer-games/computer-games.module.ts
  - docs/roadmap/vs-computer-stockfish/session-02-handoff.md
model: "sonnet"
---

# Session 02: API — StockfishService + ComputerGamesService + endpoints

Paste this into a new Claude Code session:

```md
## Continuity

Continue from Session 01 artifacts.
Read: `docs/roadmap/vs-computer-stockfish/session-01-handoff.md`
Read: `apps/api/src/computer-games/stockfish.service.ts` (stub to fill)
Read: `apps/api/src/computer-games/computer-games.service.ts` (stub to fill)
Read: `apps/api/src/computer-games/computer-games.controller.ts` (stub to fill)
Read: `apps/api/src/chess/engine.service.ts` (pattern to follow)
Read: `packages/shared/src/dto/computer-game.dto.ts` (DTOs to use)

## Mission

Implement the full API backend for computer games: Stockfish UCI bridge, game creation, move submission, and state retrieval, all wired into the existing NestJS module.

## Repository anchors

- `apps/api/src/computer-games/` — all changes go here
- `apps/api/src/chess/engine.service.ts` — engine helper to reuse for move validation
- `apps/api/src/database/database.module.ts` — Prisma client injection pattern
- `packages/shared/src/dto/computer-game.dto.ts` — DTOs

## Tasks

1. Implement `StockfishService` in `apps/api/src/computer-games/stockfish.service.ts`:
   - Import `stockfish` (the npm WASM/JS package). Spawn one Stockfish instance per `getBestMove()` call using `stockfish()` factory, send UCI commands, read `bestmove` line, then terminate.
   - Method: `async getBestMove(fen: string, skillLevel: number, movetime?: number): Promise<string>`
   - Map user levels 1–8 to UCI skill levels: `[0, 3, 5, 8, 11, 14, 17, 20]`
   - Send: `setoption name Skill Level value <N>`, `position fen <fen>`, `go movetime <ms>` (default 1000ms).
   - Parse `bestmove <uci>` from output. Throw if no bestmove within 5 seconds.

2. Implement `ComputerGamesService` in `apps/api/src/computer-games/computer-games.service.ts`:
   - Inject `PrismaService` and `StockfishService` and `EngineService`.
   - `createGame(userId: string, dto: CreateComputerGameDto): Promise<ComputerGameStateDto>`
     - Resolve color (random → pick randomly)
     - Create `Game` row with `isVsComputer: true`, `computerLevel: dto.level`, `computerColor`, `status: 'active'`, `startedAt: now`, `whiteUserId` / `blackUserId` set to `userId` on the user's side, `null` on the computer side.
     - If computer plays white, call `StockfishService.getBestMove` from starting FEN and record the move as a `Move` row.
     - Return `ComputerGameStateDto`.
   - `submitMove(gameId: string, userId: string, dto: ComputerMoveDto): Promise<ComputerGameStateDto>`
     - Load game + moves from DB. Verify it's the user's turn. Apply move via `EngineService`. Detect result.
     - If game not over, call `StockfishService.getBestMove` and apply the computer move. Detect result again.
     - Persist both moves to `Move` table. Update `Game` (finalFen, pgn, result/status if terminal).
     - Return updated `ComputerGameStateDto`.
   - `getGame(gameId: string, userId: string): Promise<ComputerGameStateDto>`
     - Load and return state.

3. Implement `ComputerGamesController` in `apps/api/src/computer-games/computer-games.controller.ts`:
   - Use `@UseGuards(SessionAuthGuard)` on all endpoints.
   - `POST /computer-games` — body `CreateComputerGameDto` → `createGame`
   - `POST /computer-games/:id/move` — body `ComputerMoveDto` → `submitMove`
   - `GET /computer-games/:id` — → `getGame`

4. Wire `StockfishService`, `ComputerGamesService`, `ComputerGamesController`, `ChessEngineModule`, and `DatabaseModule` into `ComputerGamesModule`.

5. Add a unit test for `StockfishService.getBestMove` (mock the stockfish factory, assert UCI command sequence and move parsing). Place at `apps/api/test/computer-games/stockfish.service.spec.ts`.

## Deliverables

- `apps/api/src/computer-games/stockfish.service.ts`
- `apps/api/src/computer-games/computer-games.service.ts`
- `apps/api/src/computer-games/computer-games.controller.ts`
- `apps/api/src/computer-games/computer-games.module.ts`
- `apps/api/test/computer-games/stockfish.service.spec.ts`
- `docs/roadmap/vs-computer-stockfish/session-02-handoff.md`

## Quality gates

    cd apps/api && npm run build
    cd apps/api && npm run lint
    cd apps/api && npm test -- --testPathPattern=computer-games

## Exit criteria

- Zero TypeScript errors in `apps/api`
- `StockfishService` unit test passes (mock-based, no real Stockfish binary needed in CI)
- All three endpoints (`POST /computer-games`, `POST /computer-games/:id/move`, `GET /computer-games/:id`) exist in the compiled output
- Handoff doc written to `docs/roadmap/vs-computer-stockfish/session-02-handoff.md`
```
