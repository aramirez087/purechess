---
session: 4
title: "Web — computer game board page"
depends_on: [2, 3]
touches:
  - apps/web/src/app/computer-game/**
  - apps/web/src/components/play/**
parallel_safe: false
produces:
  - apps/web/src/app/computer-game/[gameId]/page.tsx
  - apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx
  - docs/roadmap/vs-computer-stockfish/session-04-handoff.md
model: "sonnet"
---

# Session 04: Web — computer game board page

Paste this into a new Claude Code session:

```md
## Continuity

Continue from Session 02 and Session 03 artifacts.
Read: `docs/roadmap/vs-computer-stockfish/session-02-handoff.md`
Read: `docs/roadmap/vs-computer-stockfish/session-03-handoff.md`
Read: `apps/web/src/app/games/[gameId]/page.tsx` (pattern for game page)
Read: `apps/web/src/components/board/chessboard.tsx` (board component API)
Read: `packages/shared/src/dto/computer-game.dto.ts` (state DTO)

## Mission

Build the computer game board page: load game state, render the chessboard, handle the human move → API call → computer move response loop, and show the game result when the game ends.

## Repository anchors

- `apps/web/src/app/computer-game/[gameId]/` — new route, add `page.tsx` + `computer-game-client.tsx`
- `apps/web/src/components/board/` — existing `Chessboard` component to use
- `apps/web/src/lib/api.ts` — `submitComputerMove` and `getComputerGame` helpers to add

## Tasks

1. Add two API helpers to `apps/web/src/lib/api.ts`:
   - `submitComputerMove(gameId, move): Promise<ComputerGameStateDto>` — POST `/api/computer-games/:id/move`
   - `getComputerGame(gameId): Promise<ComputerGameStateDto>` — GET `/api/computer-games/:id`

2. Create `apps/web/src/app/computer-game/[gameId]/page.tsx` — server component that passes `params.gameId` to the client component.

3. Create `apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx`:
   - On mount, call `getComputerGame(gameId)` to hydrate initial state.
   - Render `<Chessboard>` with the current FEN; orient board from the user's color (`computerColor` is computer's color, so flip).
   - On a valid move (from the board's `onMove` callback), call `submitComputerMove` and update state with the response.
   - Disable board interaction when: it is the computer's turn (show a loading indicator), or the game is over.
   - When `status === 'completed'`, show a result banner: "You won", "You lost", or "Draw", with the reason (checkmate / timeout / stalemate / etc.).
   - "Resign" button: POST a resign move (`{ move: 'resign' }`) — handle gracefully in both API and UI.
   - Show basic move list (PGN moves) in a sidebar, auto-scrolling to the latest.

4. Handle the `resign` action on the API side: in `ComputerGamesService.submitMove`, if `dto.move === 'resign'`, mark the game as completed with result = computer wins, reason = resignation. (Edit `apps/api/src/computer-games/computer-games.service.ts`.)

## Deliverables

- `apps/web/src/app/computer-game/[gameId]/page.tsx`
- `apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx`
- `apps/web/src/lib/api.ts` (modified — add two helpers)
- `apps/api/src/computer-games/computer-games.service.ts` (modified — resign handling)
- `docs/roadmap/vs-computer-stockfish/session-04-handoff.md`

## Quality gates

    cd apps/web && npm run lint
    cd apps/web && npx tsc --noEmit
    cd apps/api && npm run build
    cd apps/api && npm run lint

## Exit criteria

- Route `/computer-game/[gameId]` exists and renders the chessboard
- Human moves trigger `submitComputerMove`; computer response updates the board
- Board is disabled when game is over; result banner displays
- "Resign" ends the game immediately
- Zero TypeScript errors in both `apps/web` and `apps/api`
- Handoff doc written to `docs/roadmap/vs-computer-stockfish/session-04-handoff.md`
```
