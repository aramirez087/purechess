---
depends_on: [03, 08, 12]
touches:
  - "apps/web/src/app/play/[gameId]**"
  - "apps/web/src/app/play/[gameId]/page.tsx"
  - "apps/web/src/app/play/[gameId]/game-client.tsx"
  - "apps/web/src/components/game/**"
  - "apps/web/src/components/game/clocks.tsx"
  - "apps/web/src/components/game/move-list.tsx"
  - "apps/web/src/components/game/captured-pieces.tsx"
  - "apps/web/src/components/game/game-controls.tsx"
  - "apps/web/src/components/game/game-over-dialog.tsx"
  - "apps/web/src/components/game/connection-indicator.tsx"
  - "apps/web/src/hooks/use-game.ts"
  - "apps/web/src/stores/game-store.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 14: Active Game Page

## Mission

Bring it all together: the live chess game screen. The board from Session 12, the clocks, the move list, the captured pieces, the controls (resign, draw, abort), the game-over dialog, and the reconnection indicator. This is the screen the user spends the most time in.

## Tasks

1. **Routes**:
   - `apps/web/src/app/play/[gameId]/page.tsx` — server entry, fetches initial game snapshot via REST, passes to client.
   - `apps/web/src/app/play/[gameId]/game-client.tsx` — client component, runs the game loop.
2. **Layout** (responsive):
   - Mobile: vertical stack — top opponent info + clock, board, bottom player info + clock, collapsible move list, controls in a bottom action bar.
   - Desktop: side-by-side — board centered, player cards above/below, clocks attached to each card, move list as a side panel, controls under the board.
   - Board always uses the largest available square without overflow.
3. **Clocks** (`clocks.tsx`):
   - Two clocks (one per player), large numerals, monospaced, `tabular-nums`.
   - Active clock pulses very subtly; inactive is muted.
   - Low time (≤ 30s): red text and 1Hz pulse.
   - Critical time (≤ 10s): larger pulse, optional sound tick (off by default; settable in Session 22).
   - Display: `M:SS` for ≥ 1 min, `0:SS.t` for < 1 min (deciseconds).
4. **Move list** (`move-list.tsx`):
   - Two-column: move number, white SAN, black SAN.
   - Auto-scroll to last move.
   - Click a move to seek the board to that position (review-style; uses Session 12's read-only mode).
   - Current move is bold; played moves are dim.
5. **Captured pieces** (`captured-pieces.tsx`):
   - Small row above/below the board showing captured pieces by side, with material advantage count (e.g., "+3").
6. **Game controls** (`game-controls.tsx`):
   - Icon-only buttons: Resign, Offer Draw, Abort (only if no moves played and casual).
   - On click, a small confirm popover.
   - Draw offered by opponent → accept/decline inline.
7. **Game over dialog** (`game-over-dialog.tsx`):
   - On `game:result` event, show a clean centered dialog with:
     - Result (e.g., "You won", "You lost", "Draw").
     - Reason.
     - Rating change (if rated) — green for positive, red for negative.
     - Buttons: **Review game** → `/games/<id>`, **New game** → `/play`, **Close** → `/`.
   - Closes on Esc or click-outside.
8. **Connection indicator** (`connection-indicator.tsx`):
   - Top-right dot: green (connected), yellow (reconnecting), red (offline).
   - On disconnect, the board shows a translucent overlay "Reconnecting…" with elapsed time.
   - On reconnect, the overlay clears and the live state resumes.
9. **Hook** (`use-game.ts`):
   - Connects to WebSocket, emits `game:join`, listens for `game:state`, `game:move-made`, `game:result`, `game:draw-offered`, `game:error`.
   - Maintains local state (Zustand) and renders pieces.
   - Optimistic local move: when user makes a move locally, show it immediately; on server `game:move-made`, reconcile. On rejection, snap back.
10. **Store** (`game-store.ts`):
    - Holds `gameState`, `pendingMove`, `lastServerMovePly`, `premove`, `connectionStatus`.
    - Replayable: the store can be reset by passing a new initial snapshot.
11. **Reconnection on mount**:
    - On mount, hit `GET /api/games/:id/snapshot` to get current state (REST).
    - Open WebSocket, emit `game:join`, reconcile with REST snapshot.
12. **Page metadata**:
    - Title: "Purchess — Playing" while active; "Purchess — Game over" after.
    - Open Graph tags for completed games (used in profile links later).
13. **Performance**:
    - Move list virtualized only if > 200 moves (rare; full rendering is fine for normal games).
    - No full re-renders on each tick: clock component re-renders at 4Hz max; other components render only on state changes.
14. **Accessibility**:
    - Move list is a listbox; arrow keys navigate, Enter activates seek.
    - All buttons keyboard-reachable.
    - Result announced via `aria-live="assertive"`.
15. **Tests**:
    - Component: clock formatting, low-time styling, move-list click-to-seek, game-over dialog.
    - Hook: simulated socket events produce correct state transitions; reconnection flow.
    - E2E (Playwright): two browsers play a full 1+0 game end-to-end and assert result.
16. **Verification**:
    - Manual: full game in two tabs plays smoothly.
    - Reconnect: kill one tab's network, restore, board resumes without desync.
    - Lighthouse perf ≥ 85 on the game page.

## Deliverables

- `/play/[gameId]` route serving live games.
- Reusable clocks, move list, captured pieces, game over dialog.
- `use-game` hook + `game-store` ready for reuse in review mode.
- Playwright E2E test covering a full game.

## Notes for Downstream Sessions

- The same `<Chessboard>` from Session 12 is used here; nothing custom for live games.
- Session 18 (review) reuses the move list and clock-display components, but in read-only mode.
- The `use-game` hook assumes the user is one of the two players. If a third user opens the URL, they see a "spectator not allowed" message in MVP (spectator mode is out of scope).
- Server-authoritative invariant: never trust the local store for clock values. The server pushes a `game:state` snapshot on every move; the client uses that to recompute local clock from `lastTickAt` for smooth countdown, but the source of truth is the server.
- The game page must be robust to late joiners (e.g., if the second player hasn't connected yet, show "Waiting for opponent to connect…" with their username and an "Abort game" button if applicable).
