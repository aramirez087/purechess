---
session: 4
title: "Clocks: ticking per-side clock + engine movetime display"
depends_on: [1]
touches:
  - apps/web/src/components/computer-game/game-clock.tsx
  - apps/web/src/hooks/use-game-clock.ts
  - apps/web/test/computer-game/use-game-clock.test.ts
parallel_safe: true
produces:
  - apps/web/src/components/computer-game/game-clock.tsx
  - apps/web/src/hooks/use-game-clock.ts
  - apps/web/test/computer-game/use-game-clock.test.ts
model: "sonnet"
---

# Session 04: Clocks & time controls

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-ui/session-01-handoff.md for the
controller clock state + the game-clock/use-game-clock stub contracts. Read
docs/roadmap/vs-computer-foundations/session-01-handoff.md for the ComputerGameStateDto.clock shape.
Fill ONLY your stub files + test.

Mission: Drive a live ticking clock for each side from the server clock state, formatted for the
existing PlayerStrip.clock prop, and show the engine's last movetime for time-pressure practice.

Repository anchors:
- apps/web/src/hooks/use-game-clock.ts (stub)
- apps/web/src/components/computer-game/game-clock.tsx (stub; PlayerStrip.clock already accepts a
  string — the shell passes controller.clock, which this hook computes)
- apps/web/src/app/computer-game/[gameId]/use-computer-game.ts (controller exposes clock state + the
  side to move; do not mutate server state from here)

Tasks:
1. use-game-clock: given per-side remaining ms + lastTickAt + side-to-move from the controller,
   tick the active side down on a requestAnimationFrame/interval, pausing when the game is not
   active; return formatted strings ("1:23", "0:09.4" under 10s) + a low-time flag. Untimed -> null.
2. game-clock.tsx: a small presentational readout for the engine's last movetime used (e.g. "0.9s"),
   for placement near the computer strip; low-time styling reuses the bespoke palette.
3. Reconcile with the server: when a new ComputerGameStateDto arrives, snap the local clock to the
   authoritative value (no client drift accumulation).
4. Vitest test (fake timers): active side counts down, inactive side holds, untimed returns null,
   reconcile snaps to server value.

Deliverables: filled use-game-clock.ts + game-clock.tsx + test; handoff at
docs/roadmap/vs-computer-ui/session-04-handoff.md.

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/.

Exit criteria: clock ticks the active side, pauses when over, snaps to server state, formats
correctly; untimed games show no clock; tests pass with fake timers.
```
