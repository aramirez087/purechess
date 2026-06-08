---
session: 1
title: "Charter: shell refactor, controller hook, feature stubs"
depends_on: []
touches:
  - apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx
  - apps/web/src/app/computer-game/[gameId]/use-computer-game.ts
  - apps/web/src/components/board/chessboard.tsx
  - apps/web/src/components/play/computer-game-setup.tsx
  - apps/web/src/components/computer-game/**
  - apps/web/src/hooks/**
  - docs/claude-sessions/vs-computer-ui/.epic-produces-overrides.json
parallel_safe: false
produces:
  - apps/web/src/app/computer-game/[gameId]/use-computer-game.ts
  - apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx
  - apps/web/src/components/computer-game/move-controls.tsx
  - apps/web/src/components/computer-game/engine-panel.tsx
  - apps/web/src/components/computer-game/game-clock.tsx
  - apps/web/src/components/computer-game/draw-controls.tsx
  - apps/web/src/components/computer-game/review-rail.tsx
produces_strict: false
model: "opus"
---

# Session 01: Charter — shell + controller + stubs

Paste this into a new Claude Code session:

```md
Continue from the foundations epic. Read docs/roadmap/vs-computer-foundations/session-01-handoff.md
(contracts), session-02 (endpoints), session-03 (engine API), session-04 (data-layer functions)
before coding. Also read .wolf/cerebrum.md for the shell layout + design tokens.

Mission: Refactor the monolithic vs-computer page into a thin shell driven by one controller hook,
and create the empty stub files every feature session (02-09) will fill — wiring every slot so
features only edit their own file.

Repository anchors:
- apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx (456-line monolith today)
- apps/web/src/components/game/{move-panel,player-strip,board-column,board-control-bar}.tsx
  (MovePanel has onSeek+currentPly; PlayerStrip has clock — reuse, don't fork)
- apps/web/src/components/board/chessboard.tsx, apps/web/src/components/play/computer-game-setup.tsx
- apps/web/src/lib/api/computer-games.ts, apps/web/src/lib/engine/stockfish-client.ts

Tasks:
1. Create use-computer-game.ts: a controller hook owning the state machine + ALL actions wired to
   the data layer + engine client: move, takeback, seekToPly, rematch, abort, offerDraw/claimDraw,
   resign, requestHint, analysis(eval/PV), clock state, level/think-time/elo setters, and a derived
   `clock` string for PlayerStrip. Include resume-determinism: do NOT re-think if the bot reply is
   already persisted; pass a deterministicSeed for non-Master levels.
2. Rewrite computer-game-client.tsx as a thin shell that consumes the hook, passes onSeek to
   MovePanel, passes clock to PlayerStrip, disables premoves, and renders the stub components below.
3. Add an `arrows?` prop to chessboard.tsx (SVG overlay aligned to squares) for hint/analysis arrows;
   create components/board/board-arrows.tsx as a stub. Do not implement arrow logic — just the slot.
4. Pre-slot opening-picker + fen-setup stubs into computer-game-setup.tsx (imports + placement only).
5. Create EMPTY but typed stub files (export a component/hook that renders nothing / no-ops) so each
   feature session fills exactly one: components/computer-game/{move-controls,engine-panel,eval-bar,
   game-clock,draw-controls,resign-confirm-dialog,game-result-banner,review-rail,opening-picker,
   fen-setup-board,live-announcer}.tsx and hooks/{use-game-navigation,use-engine-analysis,
   use-game-clock,use-game-keyboard}.ts. Each stub's props/return type must be final (features only
   fill bodies). Document every stub + its contract in the handoff.
6. Confirm SettingsDialog is already wired in the rail (it is) — note it, change nothing.
7. If any planned feature file already exists or must move, write .epic-produces-overrides.json.

Deliverables: refactored shell + controller + all stub files (paths above); handoff at
docs/roadmap/vs-computer-ui/session-01-handoff.md mapping each stub file -> owning session -> contract.

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/. The page must still load and play a full game (stubs render nothing yet).

Exit criteria: shell compiles + plays; every stub file exists with a final typed signature; onSeek
+ clock + premove-disable wired; arrows slot present; handoff maps stubs to sessions 02-09.
```
