---
session: 2
title: "API: takeback / rewind / abort / draw / rematch + clock-aware moves"
depends_on: [1]
touches:
  - apps/api/src/computer-games/computer-games.controller.ts
  - apps/api/src/computer-games/computer-games.service.ts
  - apps/api/src/computer-games/computer-games.module.ts
  - apps/api/src/computer-games/computer-game-actions.service.ts
  - apps/api/test/computer-games/computer-games.service.spec.ts
  - apps/api/test/computer-games/computer-game-actions.service.spec.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
parallel_safe: true
produces:
  - apps/api/src/computer-games/computer-games.controller.ts
  - apps/api/src/computer-games/computer-game-actions.service.ts
  - apps/api/test/computer-games/computer-game-actions.service.spec.ts
model: "opus"
---

# Session 02: API capabilities

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-foundations/session-01-handoff.md
for the exact DTO shapes and endpoint signatures before coding.

Mission: Add authoritative server endpoints for takeback, rewind, abort, draw (offer/accept/
decline/claim), and rematch to the vs-computer feature, and make move submission clock-aware.

Repository anchors:
- apps/api/src/computer-games/computer-games.controller.ts (only create/move/get today)
- apps/api/src/computer-games/computer-games.service.ts (submitMove, createGame, getGame)
- apps/api/src/computer-games/computer-games.module.ts
- apps/api/src/chess/engine/{game-state,result-detector,clock,fen-utils}.ts
- apps/api/prisma/schema.prisma (Game, Move; engineStateSnapshot column already exists)

Tasks:
1. Add a `ComputerGameActionsService` for state-mutating ops; keep submitMove in the core service.
2. Takeback: delete the human's last ply (and the bot reply if present), restore the prior
   engineStateSnapshot/FEN/clock. Rewind: truncate Moves to ply N and restore that snapshot.
   Respect the UNIQUE (gameId, ply) constraint — DELETE rows, never re-insert over them.
3. Abort: only when zero player moves have been made; mark the game aborted (no rating impact).
4. Draw: implement offer/accept/decline and claim (threefold_repetition / fifty_move_rule /
   stalemate) using detectResult; set result=draw + the correct GameTermination.
5. Rematch: create a new game with the same level/color/time-control settings; CreateFromFen too.
6. Clock-aware submitMove: when timeControlSeconds is set, tick/applyIncrement per clock.ts,
   persist clock state, and detect flag-fall. Guard bug-005 (check state.moves.length grew).
7. Wire all routes in the controller and provider in the module. Add Jest specs covering each new
   path including takeback-with-no-moves, rewind bounds, abort-after-move rejection, and flag-fall.

Deliverables:
- Controller routes + ComputerGameActionsService + module wiring; clock-aware submitMove.
- Prisma migration if a schema field is needed (e.g. status 'aborted', drawOfferedBy).
- Jest specs (paths in touches).
- docs/roadmap/vs-computer-foundations/session-02-handoff.md with final route table + status codes.

Quality gates (run, must pass):
- pnpm --filter @purechess/shared build
- cd apps/api && pnpm typecheck && pnpm lint && pnpm test
- engine coverage gate (90/90/85) still green

Exit criteria: every new endpoint validated server-side, persists correctly, has passing specs;
no (gameId, ply) collisions; flag-fall handled without 500.
```
