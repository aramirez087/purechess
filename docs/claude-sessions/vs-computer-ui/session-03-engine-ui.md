---
session: 3
title: "Engine UI: eval bar, PV panel, hint arrow, analyze mode, think-time"
depends_on: [1]
touches:
  - apps/web/src/components/computer-game/engine-panel.tsx
  - apps/web/src/components/computer-game/eval-bar.tsx
  - apps/web/src/components/board/board-arrows.tsx
  - apps/web/src/hooks/use-engine-analysis.ts
  - apps/web/test/computer-game/engine-panel.test.tsx
parallel_safe: true
produces:
  - apps/web/src/components/computer-game/engine-panel.tsx
  - apps/web/src/components/computer-game/eval-bar.tsx
  - apps/web/src/components/board/board-arrows.tsx
  - apps/web/src/hooks/use-engine-analysis.ts
  - apps/web/test/computer-game/engine-panel.test.tsx
model: "sonnet"
---

# Session 03: Engine analysis UI

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-ui/session-01-handoff.md for the
controller hint/analysis API and the engine-panel/eval-bar/board-arrows/use-engine-analysis stub
contracts. Read docs/roadmap/vs-computer-foundations/session-03-handoff.md for the engine client API
(analyze/getHint/cancel/warmUp/EngineEval). Fill ONLY your stub files + test.

Mission: Surface engine evaluation and assistance — a live eval bar + numeric score, top 1-3 PV
lines, a Hint button that draws an arrow on the board, an adjustable think-time, and an
"Analyze this game" mode that walks the moves with eval. Cancellable.

Repository anchors:
- apps/web/src/components/computer-game/{engine-panel,eval-bar}.tsx (stubs)
- apps/web/src/components/board/board-arrows.tsx (stub; chessboard `arrows` prop added by charter)
- apps/web/src/hooks/use-engine-analysis.ts (stub)
- apps/web/src/lib/engine/stockfish-client.ts (analyze, getHint, cancel, warmUp)

Tasks:
1. use-engine-analysis: subscribe to analyze(fen, {multiPv, movetimeMs}) for the live position,
   expose eval (cp/mate), PV lines, hint move, loading/warming-up, and a cancel(). Debounce on fen.
2. EvalBar: vertical bar mapping cp/mate to a 0-100% fill (white advantage up), with a numeric
   readout; clamp + handle mate scores.
3. EnginePanel: render the score, top 1-3 PV (SAN), a Hint button (sets the hint arrow via the
   controller/board-arrows), a think-time selector (250ms / 1s / 3s / Analyze), and an
   "Analyze this game" toggle that iterates plies showing eval. Show "Engine warming up" until ready.
4. BoardArrows: render SVG arrows for hint/best-move/PV over the board squares (orientation-aware).
5. Vitest test (mock the engine client): eval bar maps a +200cp eval, hint sets an arrow, cancel
   stops analysis, warming-up state shows before ready.

Deliverables: filled engine-panel.tsx, eval-bar.tsx, board-arrows.tsx, use-engine-analysis.ts +
test; handoff at docs/roadmap/vs-computer-ui/session-03-handoff.md.

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/.

Exit criteria: eval bar + PV + hint arrow + think-time + analyze mode render and update from the
(mocked) engine; analysis is cancellable; tests pass.
```
