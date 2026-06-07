---
depends_on: [03]
touches:
  - "apps/web/src/components/board/**"
  - "apps/web/src/components/board/chessboard.tsx"
  - "apps/web/src/components/board/square.tsx"
  - "apps/web/src/components/board/piece.tsx"
  - "apps/web/src/components/board/coordinates.tsx"
  - "apps/web/src/components/board/move-input.tsx"
  - "apps/web/src/components/board/hooks/**"
  - "apps/web/src/lib/board/**"
  - "apps/web/src/lib/board/position.ts"
  - "apps/web/src/lib/board/animations.ts"
  - "apps/web/src/lib/board/sound.ts"
  - "apps/web/src/lib/board/piece-svgs.tsx"
  - "apps/web/src/lib/board/premove.ts"
  - "apps/web/src/lib/board/coord-toggle.ts"
  - "apps/web/test/board/**"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 12: Chess Board Component

## Mission

Build **the product's centerpiece**: a fast, responsive, mobile-first chess board. This component must feel better than Lichess and Chess.com — smooth drag/drop on touch and mouse, click-to-move, legal-move highlights, last-move highlight, check highlight, premove support, and zero perceptible lag.

This is the most important UI in the app. Every other frontend session composes around it.

## Tasks

1. **Board architecture**:
   - Pure component: `<Chessboard position={FenString} orientation="white"|"black" legalMoves={...} onMove={...} lastMove? checkSquare? premove? settings />`.
   - Internally uses `chess.js` for client-side legal-move preview (server-authoritative; this is UX only).
   - Renders an 8×8 grid of `<Square>` components; no canvas, no SVG `<use>` overhead — direct DOM for speed.
2. **Pieces**:
   - Inline SVG pieces in two styles (one light wood-friendly, one dark) — both modern, crisp at 1x, no aliasing.
   - No external image network calls. All pieces inlined as React components in `piece-svgs.tsx`.
   - Use `currentColor` so the theme controls fill.
3. **Squares**:
   - CSS variables for light/dark theme. Resizable from CSS (e.g., `aspect-square`, square size in `px` from a context).
   - Highlight states via class names: `selected`, `legal-move`, `legal-capture`, `last-move-from`, `last-move-to`, `in-check`, `premove`.
4. **Drag & drop**:
   - Mouse: pointer events, not native HTML5 drag (which is janky on Linux and bad on touch).
   - Touch: same pointer events, with `touch-action: none` to disable scroll-on-drag.
   - Trackpad: works via mouse events.
   - During drag, the piece follows the pointer (transform on a clone), the source square dims.
   - On drop, snap to destination or animate back if illegal.
5. **Click-to-move**:
   - First click selects, second click on legal destination moves.
   - Click on own piece re-selects.
   - Click off-board deselects.
6. **Legal-move preview**:
   - On hover/select of a piece, show all legal destination squares.
   - Captures: small ring around the square.
   - Non-captures: small dot in the center.
   - Promotion: when the move is a promotion, show a small inline picker (Queen/Rook/Bishop/Knight).
7. **Last move highlight**:
   - Subtle background tint on the source and destination of the last move. Theme-aware (works on both light and dark).
8. **Check highlight**:
   - King square in check gets a soft red background pulse (single, restrained animation).
9. **Premoves**:
   - During the opponent's turn, allow queueing one move. Show a translucent "ghost" piece on the destination.
   - On opponent's move, validate premove legality; if illegal, discard silently; if legal, send to server with the opponent's move commit.
   - One premove at a time. New premove replaces old.
10. **Animations**:
    - Smooth piece translate on move (200ms, ease-out, GPU-accelerated transform).
    - Capture: captured piece fades out, mover slides in.
    - Castle: rook slides simultaneously with the king.
    - En passant: captured pawn fades.
    - All animations respect `prefers-reduced-motion`.
11. **Sound** (basic, real audio):
    - `sound.ts` with Web Audio API. Generated tones for move/capture/check/mate/game-start. No external mp3s.
    - Toggleable via board settings (Session 22). Defaults on.
12. **Coordinates**:
    - Optional a-h, 1-8 file/rank labels around the board. Toggled. Default off for playing, on for review.
    - Coordinates are placed outside the playable squares, not overlapping pieces.
13. **Resizing**:
    - Board fills its container, max-width 720px on desktop, full width on mobile.
    - `ResizeObserver` keeps square aspect ratio.
14. **Accessibility**:
    - Keyboard playable: arrow keys move a focus cursor, Enter drops a piece, Esc cancels.
    - Each square has `aria-label` (e.g., "e4, white pawn, legal to e5, f5, d5").
    - Focus visible with a clear ring.
    - Reduced-motion fallback skips animations.
15. **Performance**:
    - Memoized piece components; squares memoized on `(file, rank, piece, highlights)`.
    - 60fps drag on a mid-tier Android device. No layout thrash.
    - Initial mount < 16ms.
16. **Tests** (`apps/web/test/board/`):
    - Pure position helpers: legal moves from FEN, last-move square set, in-check detection.
    - Premove: legal queued, illegal discarded, only one at a time.
    - Coordinates toggle changes DOM.
    - Reduced-motion disables animation classes.
    - Keyboard: arrow + Enter plays a move.
17. **Verification**:
    - Manual: drag, click, touch all work.
    - Lighthouse: <100ms input delay on the board page.
    - Bundle: board + pieces + sound < 60KB gzipped.

## Deliverables

- `<Chessboard>` component used by Sessions 13, 14, 18.
- Settings consumed via context (theme, coordinates, sound) — defaults provided, real toggles added in Session 22.
- Pure helpers in `lib/board/` that other sessions can use (e.g., for review mode).
- Test coverage on the pure logic.

## Notes for Downstream Sessions

- The board is a **presentational** component. It does not own game state, does not connect to the server. Parent (the active game page in Session 14) passes `position`, `legalMoves`, `orientation`, `onMove`.
- For review mode (Session 18), the same component is used in "read-only" with no `onMove` and arrows showing last-move selection.
- Premoves are an implementation detail of this session's board state. The parent doesn't need to know; the board emits `onMove` when a premove becomes active.
- No themes marketplace. Only two board color variants (light/dark) controlled by the app theme.
