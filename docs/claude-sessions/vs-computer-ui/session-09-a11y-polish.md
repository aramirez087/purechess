---
session: 9
title: "UX & a11y: keyboard shortcuts + aria-live move announcements"
depends_on: [2, 3, 4, 5]
touches:
  - apps/web/src/hooks/use-game-keyboard.ts
  - apps/web/src/components/computer-game/live-announcer.tsx
  - apps/web/test/hooks/use-game-keyboard.test.ts
parallel_safe: true
produces:
  - apps/web/src/hooks/use-game-keyboard.ts
  - apps/web/src/components/computer-game/live-announcer.tsx
  - apps/web/test/hooks/use-game-keyboard.test.ts
model: "sonnet"
---

# Session 09: UX & a11y polish

Paste this into a new Claude Code session:

```md
Continue from Session 01, 02, 03, 04, 05 artifacts. Read docs/roadmap/vs-computer-ui/session-01-handoff.md
for the use-game-keyboard + live-announcer stub contracts, and sessions 02/03/05 handoffs for the
action names exposed by the controller (move/takeback/hint/resign/flip/new). Fill ONLY your two stub
files + test.

Mission: Make the live vs-computer game keyboard-operable and screen-reader aware, matching the
review page's existing shortcut conventions.

Repository anchors:
- apps/web/src/hooks/use-game-keyboard.ts (stub)
- apps/web/src/components/computer-game/live-announcer.tsx (stub)
- apps/web/src/components/review/review-controls.tsx (existing left/right/Home/End shortcut pattern
  to mirror for arrow-key ply navigation)
- apps/web/src/app/computer-game/[gameId]/use-computer-game.ts (controller actions; premoves already
  disabled by the charter)

Tasks:
1. use-game-keyboard: bind n=new game, r=resign (-> confirm dialog), u=takeback, h=hint, f=flip, and
   left/right/Home/End for ply scrub (reusing the controller's seek). Ignore keys while typing in an
   input/textarea/contenteditable; respect game-over state; clean up listeners on unmount.
2. LiveAnnouncer: an aria-live="polite" visually-hidden region that announces the computer's last
   move in SAN ("Computer played Nf3") and the game result, so board updates aren't silent.
3. Ensure every interactive control added this epic is reachable by Tab with a visible focus ring
   (audit the new components; fix any gaps in your own files — do not edit other sessions' files,
   instead note residual gaps in the handoff).
4. Vitest test: pressing "h" triggers hint, "u" triggers takeback, typing in an input is ignored,
   announcer text updates when lastComputerMove changes.

Deliverables: filled use-game-keyboard.ts + live-announcer.tsx + test; handoff at
docs/roadmap/vs-computer-ui/session-09-handoff.md (note any focus gaps in other files).

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/.

Exit criteria: shortcuts work and ignore text fields; computer moves are announced via aria-live;
tests pass.
```
