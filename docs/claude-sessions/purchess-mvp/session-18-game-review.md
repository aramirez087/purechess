---
depends_on: [03, 11, 12]
touches:
  - "apps/web/src/app/games/[gameId]**"
  - "apps/web/src/app/games/[gameId]/page.tsx"
  - "apps/web/src/app/games/[gameId]/review-client.tsx"
  - "apps/web/src/components/review/**"
  - "apps/web/src/components/review/review-board.tsx"
  - "apps/web/src/components/review/review-controls.tsx"
  - "apps/web/src/components/review/review-move-list.tsx"
  - "apps/web/src/components/review/review-metadata.tsx"
  - "apps/web/src/components/review/pgn-actions.tsx"
  - "apps/web/src/hooks/use-game-review.ts"
  - "apps/web/src/lib/replay.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 18: Game Review Page

## Mission

Build the post-game review screen. The user can step through the game move by move, see the final position, copy the PGN, and download it. This is the only "analyze" surface in MVP — no engine, no accuracy, no blunder labels. Just a clean, fast, replayable record of what happened.

## Tasks

1. **Routes**:
   - `apps/web/src/app/games/[gameId]/page.tsx` — server-rendered shell. Fetches game review via `GameReviewService.getReview` (server-side) so the page is SSR and shareable.
   - `apps/web/src/app/games/[gameId]/review-client.tsx` — interactive client component for stepping through moves.
2. **Data hook** (`use-game-review.ts`):
   - Receives initial `GameReview` payload from server props.
   - Maintains a `currentPly` index (0 = start, 1 = after move 1, etc.).
   - Reconstructs FEN for the current ply by replaying moves up to that ply using `chess.js`.
3. **Replay helper** (`lib/replay.ts`):
   - Pure function: `replayToFen(moves: WireMove[], ply: number): string`.
   - Validates: replaying all moves yields `game.finalFen`. If not, the PGN is corrupt — log to Sentry (later) and show a "Could not load this game" message.
4. **Layout**:
   - Desktop: board on the left, metadata + move list on the right, PGN actions at the bottom.
   - Mobile: board on top, then metadata, then move list, then PGN actions.
   - Board uses Session 12's `<Chessboard>` in read-only mode (no `onMove`).
5. **Metadata card** (`review-metadata.tsx`):
   - White username + rating, Black username + rating, result, reason, time control, date, "Rated" or "Casual" badge.
6. **Move list** (`review-move-list.tsx`):
   - Same component as the active game page (Session 14) but driven by review state.
   - Current move is bold and auto-scrolled into view.
   - Click a move to seek.
7. **Review controls** (`review-controls.tsx`):
   - Buttons: Start (⏮), Prev (←), Next (→), End (⏭).
   - Keyboard shortcuts (per PRD):
     - **Left arrow**: previous move
     - **Right arrow**: next move
     - **Up arrow**: start
     - **Down arrow**: end
     - **Home/End** also work as aliases.
   - Shortcuts work anywhere on the page (not just when the board is focused) — the page is a single-focus context.
8. **PGN actions** (`pgn-actions.tsx`):
   - **Copy PGN** button → uses `navigator.clipboard.writeText`. Toast on success.
   - **Download PGN** button → triggers a Blob download named `purchess-<gameId>.pgn`.
   - Both pull from `game.pgn` (the canonical string).
9. **State machine**:
   - `currentPly` is the only state. The board, move list, and metadata derive from it.
   - All state is local; no server round-trips during review.
10. **Edge cases**:
    - PGN corrupt (replay mismatch): show "Could not load this game" with a contact link, do not crash.
    - Anonymous user can view any game by ID.
    - 404 if game doesn't exist.
11. **SEO**:
    - `Metadata` with title: "Purchess — <White> vs <Black>", description: "Review this <time control> <rated|casual> game: <result>.".
    - Open Graph with game card.
12. **Tests**:
    - Replay helper: known PGN → expected FENs.
    - Page: initial state at ply 0, "Next" advances, "End" lands on final FEN.
    - Keyboard shortcuts fire.
    - Copy PGN calls `navigator.clipboard.writeText` with the right string.
    - Download PGN creates a Blob with `type: 'text/plain'`.
    - Corrupt PGN shows the error message instead of crashing.
13. **Verification**:
    - Manual: open a completed game, step through with mouse and keyboard, copy and paste PGN into a third-party viewer (lichess analysis board) to confirm validity.
    - Lighthouse perf ≥ 85.

## Deliverables

- `/games/[gameId]` review page.
- Reusable review components (move list, controls, metadata) usable by other review surfaces later.
- `replayToFen` pure helper.

## Notes for Downstream Sessions

- The review page is the canonical post-game destination. Session 14's game-over dialog links here.
- No annotations, no engine eval, no opening book. Keep it simple and add to it later as a separate epic.
- The move list component is shared with Session 14. Build it once.
- Future enhancement: a "share review" permalink with `?ply=N` so users can link to a specific position. Out of scope for MVP but trivial to add (read URL on mount, set initial ply).
