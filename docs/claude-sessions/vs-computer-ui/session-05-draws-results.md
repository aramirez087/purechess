---
session: 5
title: "Draws & results: draw button, resign confirm, endgame reasons"
depends_on: [1]
touches:
  - apps/web/src/components/computer-game/draw-controls.tsx
  - apps/web/src/components/computer-game/resign-confirm-dialog.tsx
  - apps/web/src/components/computer-game/game-result-banner.tsx
  - apps/web/test/computer-game/draw-controls.test.tsx
parallel_safe: true
produces:
  - apps/web/src/components/computer-game/draw-controls.tsx
  - apps/web/src/components/computer-game/resign-confirm-dialog.tsx
  - apps/web/src/components/computer-game/game-result-banner.tsx
  - apps/web/test/computer-game/draw-controls.test.tsx
model: "sonnet"
---

# Session 05: Draws & results

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-ui/session-01-handoff.md for the
controller draw/resign API + the draw-controls/resign-confirm-dialog/game-result-banner stub
contracts. Fill ONLY your stub files + test.

Mission: Let the player offer/claim a draw, confirm before resigning, and see a clear endgame
reason — including claimable threefold-repetition and fifty-move states.

Repository anchors:
- apps/web/src/components/computer-game/{draw-controls,resign-confirm-dialog,game-result-banner}.tsx
- apps/web/src/app/computer-game/[gameId]/use-computer-game.ts (controller: offerDraw/claimDraw/
  resign + derived `canClaimDraw` reason from server state)
- packages/shared/src/game-result.ts (GameTermination: threefold_repetition, fifty_move_rule,
  draw_agreement, stalemate — reuse, do not invent)
- computer-game-client.tsx REASON_LABELS map (move/reuse into game-result-banner)

Tasks:
1. DrawControls: an "Offer draw" button; when the controller reports a claimable repetition/
   fifty-move state, show a "Claim draw" affordance instead. Use a Radix dialog/tooltip already in deps.
2. ResignConfirmDialog: replace the current one-click resign with a confirm modal (Radix dialog),
   destructive-styled, keyboard-dismissable, calling controller.resign on confirm.
3. GameResultBanner: a presentational result + reason surface (win/draw/loss tones) driven by
   GameTermination, including an inline notice when a draw is claimable mid-game.
4. Vitest test: offer calls controller; claim shown only when claimable; resign requires confirm.

Deliverables: filled three components + test; handoff at
docs/roadmap/vs-computer-ui/session-05-handoff.md.

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/.

Exit criteria: draw offer/claim wired to controller; resign needs confirmation; result reasons
surface from GameTermination including threefold/fifty-move; tests pass.
```
