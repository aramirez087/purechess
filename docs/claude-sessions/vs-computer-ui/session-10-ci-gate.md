---
session: 10
title: "CI gate: vs-computer UI green + manual play verification"
depends_on: [2, 3, 4, 5, 6, 7, 8, 9]
touches:
  - apps/web/**
  - packages/shared/**
parallel_safe: false
skip_deliverables_check: true
model: "sonnet"
---

# Session 10: CI gate (UI)

Paste this into a new Claude Code session:

```md
Continue from Sessions 02-09 artifacts. Read every handoff under docs/roadmap/vs-computer-ui/ to
know what merged and any noted gaps.

Mission: Prove the vs-computer UI epic is green and the feature composes into one coherent screen.
Fix every failure — type errors, lint errors, broken/uncovered tests, build breaks, console errors.

Repository anchors:
- apps/web (Next + Vitest), packages/shared (build first)
- apps/web/src/app/computer-game/[gameId]/computer-game-client.tsx (the integrated shell)

Tasks (run in order; iterate until all pass):
1. pnpm --filter @purechess/shared build
2. cd apps/web && pnpm typecheck
3. cd apps/web && pnpm lint
4. cd apps/web && pnpm exec vitest run test/   (scope to test/ — e2e specs pollute a bare run)
5. cd apps/web && pnpm build
6. Integration audit (read-level, no new deps): confirm the shell composes move-controls,
   engine-panel/eval-bar, game-clock, draw-controls/resign-confirm, review-rail, and the keyboard +
   announcer without prop/type drift; confirm premoves are disabled and onSeek/clock are wired.
7. Fix any failure at its source (never delete/skip tests to pass). Re-run the full sequence after
   each fix until everything is green. Log any fixes to .wolf/buglog.json.

Deliverables:
- Any fixes required to make the above pass (committed).
- docs/roadmap/vs-computer-ui/session-10-handoff.md: a go/no-go report — each command + final status,
  what was fixed, residual known issues, and a checklist of which gap from the original brief each
  session closed.

Quality gates: the five commands above, all passing.

Exit criteria: every command exits 0; the integrated vs-computer page builds and composes all
features; handoff records a clear GO with the closed-gap checklist.
```
