# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-06-07

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

- **Design bar is high.** User wants the chess UI to look better than chess.com and "use all the available space" — full-bleed, viewport-filling layouts, not narrow centered columns. Prefers an elevated premium-dark aesthetic (bespoke near-black `#0b0d0b` / panel `#121511` / gold `#d6b563`) over generic/"white-coded" looks. Pieces and board surface quality matter to them — the hand-drawn inline-SVG pieces were called "terrible." (2026-06-07)
- **Game screens should be chromeless.** User explicitly called the full-width "Purechess" top app bar on the game page unnecessary and wanted it gone to reclaim space for the board. On game/play screens, do NOT add a global nav/top bar — fold brand + settings into a rail header instead, and let the board fill the viewport. (2026-06-08)

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
- **Computer-game page is chromeless (2026-06-08 redesign).** `GameShell topBar={null}` renders NO top app bar (changed the guard from `topBar ?? <GameTopBar/>` to `topBar === undefined ? … : topBar`, so `null` hides it, `undefined` still defaults). Brand (`<Logo/>`→`/`) + `<SettingsDialog/>` were folded into the right-rail header instead. The board's vertical reserve is now a CSS var: `BoardColumn` uses `lg:max-w-[min(100%,calc(100dvh-var(--board-reserve,13rem)))]`; the computer page sets `[--board-reserve:10.5rem]` on the GameShell root (no top bar ⇒ less reserve ⇒ board fills the freed height). The review page passes nothing ⇒ keeps its top bar + 13rem default. Verified live: board ≈992px, ~14px bottom margin, no clip.
- **Premium polish lives in the shared shell (both pages benefit):** `GameShell` root has an ambient background (radial gold glow top + vignette bottom) via inline `style`. `BoardColumn` frame = rounded-12, gradient, deep shadow + faint gold halo. `PlayerStrip` gained an optional `avatar` slot (circle, gold ring when active) and a gold active-glow; active state uses a gradient + ring shadow. On the computer page Computer=`<Bot/>`, You=`<User/>`, and the `∞` clock was dropped (untimed ⇒ pass no `clock`). The right rail is: brand/settings header → `StatusHero` (local to computer-game-client: "Your move" / "Computer is thinking" while active, "GAME OVER" + result while over; tones win=gold, draw=slate, loss=red) → Moves rail → controls (Resign while active, "New game"→`/play` when over).
- **Pieces are vendored cburnett SVGs** in `apps/web/public/pieces/cburnett/` (CC-BY-SA, attribution in `public/pieces/ATTRIBUTION.md`). `getPieceSvg(type,color)` (`lib/board/piece-svgs.tsx`) returns an `<img>`-rendering component; same API as before so board/drag/captured untouched. Board square colors are HSL vars in `globals.css` (`--board-sq-*`, now green/cream `66 36% 86%` / `92 28% 44%`); `themes.ts` `classic` swatch mirrors them.
- **Captured material**: `computeMaterial(fen)` in `apps/web/src/lib/board/material.ts` (full army − pieces on board, clamped ≥0 for promotions) → `{byWhite, byBlack, advantage}`. byWhite = black glyphs White captured.
- **`packages/shared` DTOs are plain TS interfaces — NO class-validator.** The package has zero runtime deps (only `typescript` devDep) and builds with bare `tsc`. Keep new DTOs as interfaces; runtime validation belongs in the API layer (NestJS). Any field added to `ComputerGameStateDto` must be OPTIONAL or `apps/api` typecheck breaks (the `toStateDto` literal in `computer-games.service.ts` won't supply new keys). Clock fields are serialized `number` (mirrors `serializeClock()`), never `bigint`.
- **Fresh worktree gotchas (2026-06-07):** (1) `@prisma/client` exports nothing until `pnpm --filter @purechess/api db:generate` is run — typecheck errors `has no exported member 'User'` are just an ungenerated client. (2) `eslint` has no `node_modules/.bin` symlink (only transitive `eslint@8.57.1` in the pnpm store); `pnpm -r lint` can't resolve `eslint src`. Run `node node_modules/.pnpm/eslint@8.57.1/node_modules/eslint/bin/eslint.js <files>`. (3) `apps/web` typecheck is RED on pre-existing errors (`lucide-react` missing `Github`/`Twitter`, admin-table `children` props) — unrelated to shared changes.
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
