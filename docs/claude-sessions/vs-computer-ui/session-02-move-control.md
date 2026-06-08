---
session: 2
title: "Move control & navigation: takeback, rewind/scrub, rematch, abort"
depends_on: [1]
touches:
  - apps/web/src/components/computer-game/move-controls.tsx
  - apps/web/src/hooks/use-game-navigation.ts
  - apps/web/test/computer-game/move-controls.test.tsx
parallel_safe: true
produces:
  - apps/web/src/components/computer-game/move-controls.tsx
  - apps/web/src/hooks/use-game-navigation.ts
  - apps/web/test/computer-game/move-controls.test.tsx
model: "sonnet"
---

# Session 02: Move control & navigation

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-ui/session-01-handoff.md for the
controller hook API and the move-controls/use-game-navigation stub contracts. Fill ONLY those two
stub files + a test — do not edit the shell, controller, or any other feature's files.

Mission: Give the player move control — take back the last move (or move + bot reply), rewind/scrub
to any prior ply, rematch at the same settings, and abort before the first move.

Repository anchors:
- apps/web/src/components/computer-game/move-controls.tsx (stub to fill)
- apps/web/src/hooks/use-game-navigation.ts (stub to fill)
- apps/web/src/app/computer-game/[gameId]/use-computer-game.ts (controller: takeback/seekToPly/
  rematch/abort already wired to the data layer — call these; do not reimplement transport)
- apps/web/src/components/game/move-panel.tsx (onSeek already passed by the shell)

Tasks:
1. Build MoveControls: a Take back button (default last ply; modifier/secondary action for move+bot
   reply), a Rematch group ("Rematch — same settings" vs "Change settings" -> /play), and an Abort
   button visible only when abortable (zero player moves). Disable actions when not legal.
2. use-game-navigation: derive viewed-ply state from controller, expose handlers for MovePanel
   onSeek (scrub), step prev/next, and jump to live; viewing a past ply puts the board read-only.
3. Match the bespoke-hex button styling already used in computer-game-client.tsx (gold/destructive
   variants, focus-visible rings). Keep everything keyboard-operable.
4. Vitest test: takeback calls the controller, abort hidden after a move is made, scrub sets viewed
   ply + read-only.

Deliverables: filled move-controls.tsx + use-game-navigation.ts + test; handoff at
docs/roadmap/vs-computer-ui/session-02-handoff.md.

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/.

Exit criteria: takeback/rewind/rematch/abort work against the controller; abort gates on first move;
scrubbing is read-only; tests pass.
```
