# Memory

> Chronological action log. Hooks and AI append to this file automatically.
> Old sessions are consolidated by the daemon weekly.
| 10:42 | Edited apps/api/src/computer-games/computer-games.service.ts | 3→3 lines | ~57 |
| 10:43 | Edited apps/api/src/computer-games/computer-games.service.ts | added error handling | ~98 |
| 10:46 | Created ../../../../tmp/commit-msg.txt | — | ~324 |

## Session: 2026-06-07 10:48

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 10:49 | Created CLAUDE.md | — | ~1224 |

| 10:49 | /init: rewrote CLAUDE.md with commands+architecture | CLAUDE.md | done | ~6k |
| 10:49 | Session end: 1 writes across 1 files (CLAUDE.md) | 1 reads | ~1369 tok |

## Session: 2026-06-07 11:05

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 11:11 | Diagnosed app-broken: .next deleted under running server, 404 chunks | apps/web/.next, /tmp/web-dev.log | restarted dev, Quick Match vs Stockfish works | ~9k |
| 11:18 | Created ../../../../tmp/inspect.cjs | — | ~262 |
| 11:19 | Created apps/api/_repro.cjs | — | ~171 |
| 11:20 | Edited apps/api/src/computer-games/computer-games.service.ts | expanded (+10 lines) | ~119 |
| 11:23 | Edited apps/api/src/computer-games/computer-games.service.ts | added nullish coalescing | ~433 |
| 11:26 | Fixed computer-game move 500: timed-out clock -> applyMove no-append -> dup ply insert. Guard added | apps/api/src/computer-games/computer-games.service.ts | move round-trip works (e4 c5), timeout returns 200 completed | ~30k |
| 11:27 | Session end: 4 writes across 3 files (inspect.cjs, _repro.cjs, computer-games.service.ts) | 5 reads | ~4781 tok |
| 11:28 | Created apps/api/test/computer-games/computer-games.service.spec.ts | — | ~3640 |
| 11:29 | Rewrote computer-games.service.spec.ts post client-stockfish refactor; +timeout test | apps/api/test/computer-games/computer-games.service.spec.ts | 16/16 pass | ~8k |
| 11:29 | Session end: 5 writes across 4 files (inspect.cjs, _repro.cjs, computer-games.service.ts, computer-games.service.spec.ts) | 6 reads | ~10838 tok |

## Session: 2026-06-07 11:32

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 11:47 | Created ../../.claude/plans/your-goal-is-to-squishy-platypus.md | — | ~2822 |
| 11:56 | Edited ../../.claude/plans/your-goal-is-to-squishy-platypus.md | 1→3 lines | ~169 |
| 11:57 | Edited ../../.claude/plans/your-goal-is-to-squishy-platypus.md | modified getPieceSvg() | ~944 |
| 11:57 | Edited ../../.claude/plans/your-goal-is-to-squishy-platypus.md | 3→3 lines | ~242 |
| 11:57 | Edited ../../.claude/plans/your-goal-is-to-squishy-platypus.md | 1→2 lines | ~190 |
| 11:57 | Edited ../../.claude/plans/your-goal-is-to-squishy-platypus.md | 1→2 lines | ~101 |
| 12:05 | Edited apps/web/src/components/board/chessboard.tsx | 11→6 lines | ~35 |
| 12:05 | Edited apps/web/src/components/board/chessboard.tsx | expanded (+6 lines) | ~78 |
| 12:06 | Edited apps/web/src/components/board/hooks/use-board-resize.ts | added 1 condition(s) | ~142 |
| 12:07 | Created apps/web/src/lib/board/piece-svgs.tsx | — | ~639 |
| 12:07 | Created apps/web/public/pieces/ATTRIBUTION.md | — | ~136 |
| 12:08 | Edited apps/web/src/app/globals.css | 2→2 lines | ~18 |
| 12:08 | Edited apps/web/src/app/globals.css | 2→2 lines | ~19 |
| 12:08 | Edited apps/web/src/app/globals.css | 2→2 lines | ~26 |
| 12:08 | Edited apps/web/src/lib/board/themes.ts | 4→4 lines | ~24 |
| 12:09 | Created apps/web/src/lib/board/material.ts | — | ~820 |
| 12:09 | Created apps/web/test/board/material.test.ts | — | ~571 |
| 12:10 | Edited apps/web/test/board/material.test.ts | queen() → queens() | ~39 |
| 12:12 | Created apps/web/src/components/game/captured-material.tsx | — | ~421 |
| 12:13 | Created apps/web/src/components/game/player-strip.tsx | — | ~801 |
| 12:13 | Created apps/web/src/components/game/game-rail.tsx | — | ~318 |
| 12:13 | Created apps/web/src/components/game/move-panel.tsx | — | ~945 |
| 12:13 | Created apps/web/src/components/game/board-control-bar.tsx | — | ~328 |
| 12:13 | Created apps/web/src/components/game/game-top-bar.tsx | — | ~366 |
| 12:13 | Created apps/web/src/components/game/board-column.tsx | — | ~525 |
| 12:14 | Created apps/web/src/components/game/game-shell.tsx | — | ~496 |
| 12:14 | Created apps/web/src/components/game/index.ts | — | ~165 |
| 12:16 | Created apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | — | ~3613 |
| 12:16 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | inline fix | ~15 |
| 12:16 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | useState() → useRef() | ~56 |
| 12:17 | Edited apps/web/src/components/game/game-shell.tsx | 6→10 lines | ~115 |
| 12:18 | Created apps/web/src/app/games/[gameId]/review-client.tsx | — | ~1769 |
| 12:18 | Edited apps/web/src/app/games/[gameId]/page.tsx | 3→2 lines | ~28 |
| 12:18 | Edited apps/web/src/app/games/[gameId]/page.tsx | 5→1 lines | ~20 |
| 12:19 | Edited apps/web/src/components/game/move-panel.tsx | modified if() | ~36 |
| 12:22 | Edited apps/web/src/components/game/board-column.tsx | CSS: board | ~262 |
| 12:25 | Edited apps/web/src/components/game/game-shell.tsx | 10→6 lines | ~44 |
| 12:30 | Edited apps/web/src/app/providers.tsx | inline fix | ~12 |
| 12:30 | Edited apps/web/src/app/providers.tsx | modified ThemeSync() | ~368 |
| 12:31 | Verified web: typecheck ✓, lint ✓, 113 unit tests ✓ (test/) | — | — |
| 12:32 | Logged bug-015 (ThemeSync loop) + bug-016 (scrollIntoView) to buglog | .wolf/buglog.json | — |

### Session summary — 2026-06-07: Game-page redesign

Rebuilt the game UI into a full-bleed dual-rail app shell that fills the viewport (the original complaint: "looks terrible, not using the space"). Decisions (via AskUserQuestion): full app-shell dual rails · elevated premium-dark · shared shell across computer-game + review · extras = captured/material + controls + clocks · classic Staunton (cburnett) pieces · premium green/cream board.

Shipped: board height-sizing fix (chessboard.tsx + use-board-resize.ts), vendored cburnett SVGs replacing the hand-drawn glyphs (piece-svgs.tsx rewired, API unchanged), green/cream board (globals.css + themes.ts), `computeMaterial` util + test, 8 shared `components/game/*` components, refactored computer-game-client + review-client onto the shell (dropped AppShell on the review route). Verified live via chrome-devtools: 3-zone layout fills width, board fills height, strips align to board, flip swaps orientation+strips, cburnett pieces with shadows, no console errors.

Found + fixed a PRE-EXISTING global crash: ThemeSync infinite update loop (bug-015) that crashes every page when localStorage appTheme ≠ next-themes theme (user's localStorage had appTheme='dark'). Not caused by the redesign (reproduced on untouched homepage) but it blocked the user from seeing anything, so fixed it (one effect + echo-guard ref).
| 12:34 | Session end: 39 writes across 22 files (your-goal-is-to-squishy-platypus.md, chessboard.tsx, use-board-resize.ts, piece-svgs.tsx, ATTRIBUTION.md) | 68 reads | ~18509 tok |

## Session: 2026-06-07 17:33

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 17:34 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | removed 17 lines | ~36 |
| 17:34 | removed computer-thinking board overlay (distracting gray/blur) | computer-game-client.tsx | done | ~1500 |
| 17:34 | Session end: 1 writes across 1 files (computer-game-client.tsx) | 1 reads | ~3636 tok |

## Session: 2026-06-07 17:42

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|

## Session: 2026-06-07 17:42

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 17:46 | Edited apps/api/src/computer-games/computer-games.service.ts | expanded (+6 lines) | ~244 |
| 17:46 | Edited apps/web/src/components/play/computer-game-setup.tsx | 7→7 lines | ~88 |
| 17:46 | Edited apps/web/src/components/play/computer-game-setup.tsx | 3→2 lines | ~38 |
| 17:46 | Edited apps/web/src/components/play/computer-game-setup.tsx | 7→6 lines | ~51 |
| 17:46 | Edited apps/web/src/components/play/computer-game-setup.tsx | removed 18 lines | ~11 |
| 17:47 | Fixed surprise timeout loss in idle computer games: froze wall-clock in submitMove + dropped untimed setup picker | computer-games.service.ts, computer-game-setup.tsx | done; typecheck+16 spec pass | ~9k |
| 17:47 | Session end: 5 writes across 2 files (computer-games.service.ts, computer-game-setup.tsx) | 4 reads | ~7515 tok |

## Session: 2026-06-07 17:56

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 17:59 | Edited apps/web/src/components/game/game-shell.tsx | modified GameShell() | ~658 |
| 17:59 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | removed 26 lines | ~21 |
| 17:59 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | expanded (+11 lines) | ~313 |
| 18:00 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | removed 10 lines | ~16 |
| 18:00 | redesign computer-game layout: drop redundant left rail, 2-col board-dominant shell | game-shell.tsx, computer-game-client.tsx | board ~20% bigger, fills viewport height; tsc clean | ~9k |
| 18:00 | Session end: 4 writes across 2 files (game-shell.tsx, computer-game-client.tsx) | 8 reads | ~8238 tok |

## Session: 2026-06-08 18:19

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 18:24 | designqc: captured 6 screenshots (61KB, ~15000 tok) | /, /play, /games, /settings, /profile, /admin | ready for eval | ~0 |
| 18:25 | Edited apps/web/src/components/game/game-shell.tsx | CSS: background | ~120 |
| 18:25 | Edited apps/web/src/components/game/game-shell.tsx | 2→2 lines | ~34 |
| 18:25 | Edited apps/web/src/components/game/board-column.tsx | 4→4 lines | ~115 |
| 18:26 | Edited apps/web/src/components/game/player-strip.tsx | modified PlayerStrip() | ~865 |
| 18:26 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | added 4 import(s) | ~249 |
| 18:26 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | added 1 condition(s) | ~638 |
| 18:26 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | CSS: avatar | ~124 |
| 18:27 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | CSS: resultTone | ~66 |
| 18:27 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | CSS: --board-reserve | ~37 |
| 18:27 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | expanded (+24 lines) | ~845 |
| 18:30 | Edited apps/web/src/components/game/board-column.tsx | "relative mx-auto aspect-s" → "relative mx-auto aspect-s" | ~80 |
| 18:35 | Redesigned computer-game page chromeless: removed top bar, board fills viewport via --board-reserve, rail brand+settings header + StatusHero, bot/user avatars, dropped ∞ clock, premium bg/frame | computer-game-client.tsx + game-shell/board-column/player-strip.tsx | typecheck clean; verified live play + game-over | ~6k |
| 18:33 | Session end: 11 writes across 4 files (game-shell.tsx, board-column.tsx, player-strip.tsx, computer-game-client.tsx) | 11 reads | ~13663 tok |
| 18:44 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | modified ResultOverlay() | ~677 |
| 18:44 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | 2→3 lines | ~53 |
| 18:44 | Edited apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx | expanded (+10 lines) | ~136 |
| 18:45 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | CSS: children, sm, background | ~350 |
| 18:45 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | modified if() | ~170 |
| 18:45 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | modified if() | ~138 |
| 18:45 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | expanded (+11 lines) | ~302 |
| 18:46 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | 6→6 lines | ~20 |
| 18:49 | designqc: captured 6 screenshots (137KB, ~15000 tok) | /, /play, /settings, /games, /admin | ready for eval | ~0 |
| 18:50 | designqc: captured 6 screenshots (144KB, ~15000 tok) | /settings, /admin, /profile/aramirez, /games, /play/computer-game/test | ready for eval | ~0 |
| 18:51 | designqc: captured 2 screenshots (19KB, ~5000 tok) | /games | ready for eval | ~0 |
| 18:52 | designqc: captured 6 screenshots (134KB, ~15000 tok) | /demo | ready for eval | ~0 |

| 18:30 | Design pass: replaced Junior dev's flat black/white design with Silent Tournament aesthetic across home, play, settings, profile, games, admin, errors, loading, footer, app shell. Updated design tokens (globals.css, tailwind.config), added brass color, real Logo SVG mark, premium hero, lobby play page, segmented controls, improved tables. Board and pieces untouched. | apps/web/src/app/globals.css, apps/web/tailwind.config.ts, apps/web/src/components/layout/, apps/web/src/components/home/, apps/web/src/components/play/, apps/web/src/components/settings/, apps/web/src/components/profile/, apps/web/src/components/games/, apps/web/src/components/admin/, apps/web/src/app/(play)/, apps/web/src/app/admin/, apps/web/src/app/profile/, apps/web/src/app/games/, apps/web/src/app/settings/ | design-only pass, all routes 200, typecheck clean | ~25k |
| 18:59 | Created apps/web/src/app/(play)/play/play-page-client.tsx | — | ~2025 |
| 18:55 | Game-over message ON board (ResultOverlay via BoardColumn overlay prop, dismissible, shows result + "by <reason>"); redesigned /play into full-viewport centered PlayShell (ambient bg + grain + brand) | computer-game-client.tsx, (play)/play/play-page-client.tsx | typecheck clean; verified live (overlay "You lost · by Resignation"; /play centered+brand). NOTE: play-page-client was reverted externally mid-session, re-applied via Write | ~5k |
| 19:01 | Session end: 20 writes across 5 files (game-shell.tsx, board-column.tsx, player-strip.tsx, computer-game-client.tsx, play-page-client.tsx) | 13 reads | ~20596 tok |
| 19:03 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | expanded (+12 lines) | ~296 |
| 19:04 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | "mt-10 grid gap-4 sm:grid-" → "mt-12 grid gap-5 sm:grid-" | ~16 |
| 19:04 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | "group relative flex flex-" → "group relative flex min-h" | ~47 |
| 19:04 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | "inline-flex h-10 w-10 ite" → "inline-flex h-12 w-12 ite" | ~29 |
| 19:04 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | "h-5 w-5" → "h-6 w-6" | ~13 |
| 19:04 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | "text-lg font-semibold tra" → "text-xl font-semibold tra" | ~23 |
| 19:04 | Edited apps/web/src/app/(play)/play/play-page-client.tsx | "text-sm text-muted-foregr" → "text-[15px] text-muted-fo" | ~27 |
| 19:04 | Session end: 27 writes across 5 files (game-shell.tsx, board-column.tsx, player-strip.tsx, computer-game-client.tsx, play-page-client.tsx) | 13 reads | ~21047 tok |

## Session: 2026-06-08 19:11

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 19:21 | Created docs/claude-sessions/vs-computer-foundations/session-00-operator-rules.md | — | ~963 |
| 19:21 | Created docs/claude-sessions/vs-computer-foundations/session-01-contracts-charter.md | — | ~940 |
| 19:21 | Created docs/claude-sessions/vs-computer-foundations/session-02-api-endpoints.md | — | ~921 |
| 19:22 | Created docs/claude-sessions/vs-computer-foundations/session-03-engine-client.md | — | ~786 |
| 19:22 | Created docs/claude-sessions/vs-computer-foundations/session-04-web-data-layer.md | — | ~623 |
| 19:22 | Created docs/claude-sessions/vs-computer-foundations/session-05-ci-gate.md | — | ~486 |
| 19:23 | Created docs/claude-sessions/vs-computer-ui/session-00-operator-rules.md | — | ~1106 |
| 19:23 | Created docs/claude-sessions/vs-computer-ui/session-01-shell-charter.md | — | ~1167 |
| 19:23 | Created docs/claude-sessions/vs-computer-ui/session-02-move-control.md | — | ~708 |
| 19:24 | Created docs/claude-sessions/vs-computer-ui/session-03-engine-ui.md | — | ~818 |
| 19:24 | Created docs/claude-sessions/vs-computer-ui/session-04-clocks.md | — | ~706 |
| 19:24 | Created docs/claude-sessions/vs-computer-ui/session-05-draws-results.md | — | ~727 |
| 19:24 | Created docs/claude-sessions/vs-computer-ui/session-06-setup-form.md | — | ~745 |
| 19:25 | Created docs/claude-sessions/vs-computer-ui/session-07-openings.md | — | ~748 |
| 19:25 | Created docs/claude-sessions/vs-computer-ui/session-08-review-history.md | — | ~730 |
| 19:25 | Created docs/claude-sessions/vs-computer-ui/session-09-a11y-polish.md | — | ~734 |
| 19:26 | Created docs/claude-sessions/vs-computer-ui/session-10-ci-gate.md | — | ~551 |
| 19:26 | Created docs/claude-sessions/vs-computer.sprint.json | — | ~68 |
| 19:26 | Generated 2-epic sprint "vs-computer" (foundations 5 + ui 10 sessions) for Play-vs-Computer missing features | docs/claude-sessions/vs-computer-*/, vs-computer.sprint.json | DAG verified: waves 3+4, max 7-wide | ~24k |
| 19:26 | Session end: 18 writes across 17 files (session-00-operator-rules.md, session-01-contracts-charter.md, session-02-api-endpoints.md, session-03-engine-client.md, session-04-web-data-layer.md) | 8 reads | ~21491 tok |

## Session: 2026-06-08 19:29

| Time | Action | File(s) | Outcome | ~Tokens |
|------|--------|---------|---------|--------|
| 20:53 | Edited docs/claude-sessions/vs-computer-ui/session-09-a11y-polish.md | inline fix | ~14 |
| 20:57 | sprint vs-computer: epic1 foundations done+merged; epic2 ui failed s09 (exit97 deliverables path-mismatch); fixed plan path test/computer-game→test/hooks, pruned stale s09 wt+branch, resumed s9 | docs/claude-sessions/vs-computer-ui/session-09-a11y-polish.md, .wolf/buglog.json | resume running (task bxfbnz8ws) | ~22k |
| 20:57 | Session end: 1 writes across 1 files (session-09-a11y-polish.md) | 3 reads | ~770 tok |
| 21:01 | Created ../../../../tmp/omni-issue-body.md | — | ~611 |
| 21:01 | Session end: 2 writes across 2 files (session-09-a11y-polish.md, omni-issue-body.md) | 3 reads | ~1425 tok |
| 21:13 | Edited docs/claude-sessions/vs-computer-ui/session-09-a11y-polish.md | inline fix | ~8 |
| 21:15 | s09 failed AGAIN (exit97): agent non-deterministic test path (run2 wrote test/computer-game/a11y.test.tsx). Fixed produces→glob apps/web/test/*.test.ts*, pruned stale s09, resumed | session-09-a11y-polish.md, buglog bug-030, cerebrum | resume running (task blxf75zb5) | ~30k |
| 21:15 | Session end: 3 writes across 2 files (session-09-a11y-polish.md, omni-issue-body.md) | 4 reads | ~1433 tok |
