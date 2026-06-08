# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-06-07

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

- **Design bar is high.** User wants the chess UI to look better than chess.com and "use all the available space" — full-bleed, viewport-filling layouts, not narrow centered columns. Prefers an elevated premium-dark aesthetic (bespoke near-black `#0b0d0b` / panel `#121511` / gold `#d6b563`) over generic/"white-coded" looks. Pieces and board surface quality matter to them — the hand-drawn inline-SVG pieces were called "terrible." (2026-06-07)

## Key Learnings

- **Project:** purechess
- **Description:** Pure chess, nothing else. No puzzles, no lessons, no streams — just the game.
- **Computer games (client-side Stockfish):** moves are still POSTed to `apps/api/.../computer-games.service.ts#submitMove` which validates via the custom engine and persists. The server runs NO engine — the client computes both human and computer moves and submits each as one `{move:"uci"}` POST. `Move` rows have a UNIQUE `(gameId, ply)` constraint.
- **Engine `applyMove` (game-state.ts) can return WITHOUT appending a move** — the `isTimeout` early-return path returns the game `completed` with the moves array unchanged. Any caller that assumes a new move was appended (`state.moves[last]`) will reuse the previous move. Always check `state.moves.length` grew.
- **Dev gotcha:** if `apps/web/.next` is deleted while `next dev` runs, every `_next/static/*` chunk 404s as HTML, JS never hydrates, and all buttons silently do nothing. Fix = restart the web dev server. (`bug-002`)
- **`computer-games.service.spec.ts`** was rewritten 2026-06-07 after the client-side-Stockfish refactor: mocks `(PrismaService, EngineService, PosthogService)` — NO `StockfishService` (deleted). Includes a flag-fall/timeout test guarding `bug-005`.
- **Reusable game shell** lives in `apps/web/src/components/game/` (GameShell, GameTopBar, BoardColumn, PlayerStrip, CapturedMaterial, GameRail, MovePanel, BoardControlBar). Slotted/presentational, bespoke-hex dark palette. Used by both the computer-game page and the review page (`games/[gameId]`). The review page no longer wraps in `<AppShell>` — GameShell owns the chrome + the single `#main-content`.
- **GameShell `leftRail` is optional.** Omit it → shell collapses to a board-dominant 2-zone grid (`max-w-[1760px]`, `[minmax(0,1fr)_minmax(340px,400px)]`); the square board then bounds to viewport height instead of being width-starved by a 3rd column (~20% bigger). With a leftRail it stays the 3-zone `max-w-[1600px]` grid (review page). The computer-game page dropped its left "Game" rail (Opponent/You play/Time were redundant with the player strips + `∞` clock); game-over banner + moveError moved into the right rail.
- **Board sizing fills the viewport** via CSS, not JS: `BoardColumn`'s board box is `aspect-square` inside a stack capped at `max-w-[min(100%,calc(100dvh-13rem))]` (the calc encodes top-bar + strips + gaps), so the square never overflows and strips/board share one width. `use-board-resize` reads ONLY `clientWidth/8` (with a `>0` guard) — reading clientHeight feeds the grid's own height back and pins the size. The definite-height chain `h-[100dvh]→flex-1 min-h-0→grid h-full→min-h-0` must stay unbroken.
- **Pieces are vendored cburnett SVGs** in `apps/web/public/pieces/cburnett/` (CC-BY-SA, attribution in `public/pieces/ATTRIBUTION.md`). `getPieceSvg(type,color)` (`lib/board/piece-svgs.tsx`) returns an `<img>`-rendering component; same API as before so board/drag/captured untouched. Board square colors are HSL vars in `globals.css` (`--board-sq-*`, now green/cream `66 36% 86%` / `92 28% 44%`); `themes.ts` `classic` swatch mirrors them.
- **Captured material**: `computeMaterial(fen)` in `apps/web/src/lib/board/material.ts` (full army − pieces on board, clamped ≥0 for promotions) → `{byWhite, byBlack, advantage}`. byWhite = black glyphs White captured.
- **Web vitest sweeps e2e/ specs** (`vitest.config.ts` has no include/exclude) → Playwright `e2e/*.spec.ts` "fail" under `vitest run` with "did not expect test.describe()". PRE-EXISTING. Run `pnpm exec vitest run test/` to scope to real unit tests (113 pass).

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

- [2026-06-07] `submitMove` assumed `applyMove` always appends a move; on a flagged (timed-out) clock it doesn't, so it re-inserted the previous move's ply and hit the `(gameId,ply)` unique constraint → 500. When applying engine moves, guard for the no-append/flag-fall case before writing a `Move` row. (`bug-005`)
- [2026-06-07] `ThemeSync` (providers.tsx) had two bidirectional theme↔store effects that infinite-loop ("Maximum update depth exceeded") on EVERY page when localStorage `purechess-settings.appTheme` disagrees with next-themes `theme` on load. Don't write two-way mirror effects without an echo guard. Fixed with one effect + a `lastSynced` ref (store is source of truth). (`bug-015`)
- [2026-06-07] Do NOT add a nested `data-theme="..."` attribute inside the app — next-themes is configured with `attribute="data-theme"` and ThemeSync watches it; a nested one collides. To scope dark tokens use hardcoded hex or a non-colliding class, not `data-theme`. (Tested: it was NOT the loop cause, but it's a real collision to avoid.)
- [2026-06-07] In jsdom/vitest, `element.scrollIntoView` is undefined — always use the optional CALL `el?.scrollIntoView?.({...})`, not `el?.scrollIntoView({...})`, or component tests throw. (`bug-016`)
- [2026-06-07] The OpenWolf edit-watcher hook auto-appends shallow "bugs" to `buglog.json` for ordinary edits (refactors, value changes) and consumes IDs — write real bug entries with the next free id and don't rely on a specific number.

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
