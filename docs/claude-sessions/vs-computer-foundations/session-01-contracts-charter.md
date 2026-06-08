---
session: 1
title: "Charter: shared contracts for vs-computer capabilities"
depends_on: []
touches:
  - packages/shared/src/dto/computer-game.dto.ts
  - packages/shared/src/dto/engine-analysis.dto.ts
  - packages/shared/src/index.ts
  - packages/shared/src/game-result.ts
  - packages/shared/src/ws-events.ts
  - docs/claude-sessions/vs-computer-foundations/.epic-produces-overrides.json
parallel_safe: false
produces:
  - packages/shared/src/dto/computer-game.dto.ts
  - packages/shared/src/dto/engine-analysis.dto.ts
  - packages/shared/src/index.ts
  - docs/roadmap/vs-computer-foundations/session-01-handoff.md
produces_strict: false
model: "opus"
---

# Session 01: Charter — shared contracts

Paste this into a new Claude Code session:

```md
Mission: Define the single source-of-truth TypeScript contracts in `@purechess/shared` that
the API (Session 02), engine client (Session 03), and web data layer (Session 04) all build
against, so they can run in parallel without drift.

Repository anchors (read before editing):
- packages/shared/src/dto/computer-game.dto.ts (CreateComputerGameDto, ComputerMoveDto, ComputerGameStateDto)
- packages/shared/src/game-result.ts (GameResult, GameTermination enums — all draw reasons exist)
- packages/shared/src/time-control.ts, packages/shared/src/ws-events.ts, packages/shared/src/index.ts
- apps/api/src/computer-games/computer-games.service.ts + .controller.ts (current create/move/get only)
- apps/api/src/chess/engine/clock.ts (ClockSnapshot), result-detector.ts (detectResult)
- apps/web/src/lib/engine/stockfish-client.ts (getBestMove only)

Tasks (define types + DTOs only — NO endpoint/UI logic):
1. Extend computer-game.dto.ts: add optional `eloTarget`, `thinkTimeMs`, `styleBlunderCp`, and
   confirm `timeControlSeconds`/`incrementSeconds` on CreateComputerGameDto; add `clock` (per-side
   ms + lastTickAt) and `drawOffered`/`abortable` fields to ComputerGameStateDto.
2. Add request DTOs: TakebackDto (plies: 1|2), RewindToPlyDto (ply), AbortDto, DrawActionDto
   (action: 'offer'|'accept'|'decline'|'claim'), RematchDto, CreateFromFenDto (fen + settings).
   Use class-validator decorators matching existing DTO style.
3. Create packages/shared/src/dto/engine-analysis.dto.ts: EngineEval { cp?: number; mate?: number;
   depth: number; bestmove: string; pv: string[] }, EngineAnalysisOptions { movetimeMs?; multiPv?;
   eloTarget?; skill?; blunderCp?; deterministicSeed?: number }. Export from index.ts.
4. Reuse GameTermination for draw/abort reasons (do not invent new enums). If a draw/clock field
   you planned already exists, do NOT duplicate it — record it in the override file instead.
5. Build shared and confirm both apps still typecheck against the new types.
6. If any planned downstream `produces` is already satisfied or must move, write
   docs/claude-sessions/vs-computer-foundations/.epic-produces-overrides.json keyed by session stem.

Deliverables:
- Updated packages/shared DTO + index exports (paths above).
- docs/roadmap/vs-computer-foundations/session-01-handoff.md listing every new/changed type with
  its exact shape, and the endpoint + function signatures Sessions 02/03/04 must implement.

Quality gates (run, must pass):
- pnpm --filter @purechess/shared build
- pnpm -r typecheck
- pnpm -r lint

Exit criteria: shared builds; all new contracts exported from index.ts; handoff enumerates the
exact DTO shapes and the signatures for takeback/rewind/abort/draw/rematch endpoints, engine
analysis API, and web fetch wrappers.
```
