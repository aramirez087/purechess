---
session: 8
title: "Review & history: in-game PGN rail, vs-computer filter, deep-link review"
depends_on: [1]
touches:
  - apps/web/src/components/computer-game/review-rail.tsx
  - apps/web/src/hooks/use-game-history.ts
  - apps/web/src/app/games/[gameId]/page.tsx
  - apps/web/src/services/game-review.service.ts
  - apps/web/src/app/games/**
  - apps/web/test/games/**
parallel_safe: true
produces:
  - apps/web/src/components/computer-game/review-rail.tsx
  - apps/web/src/hooks/use-game-history.ts
  - apps/web/src/app/games/[gameId]/page.tsx
model: "sonnet"
---

# Session 08: Game review & history

Paste this into a new Claude Code session:

```md
Continue from Session 01 artifacts. Read docs/roadmap/vs-computer-ui/session-01-handoff.md for the
review-rail stub contract. Fill the review-rail stub; the rest are existing files you edit directly.

Mission: Make finished vs-computer games first-class in history and review — PGN/FEN actions in the
live rail, a "vs computer" filter on /games, and a working deep-link to a computer-game review.

Repository anchors:
- apps/web/src/components/computer-game/review-rail.tsx (stub; reuse components/review/pgn-actions.tsx)
- apps/web/src/components/review/pgn-actions.tsx (PGN/FEN copy + download — currently post-game only)
- apps/web/src/hooks/use-game-history.ts (no vs-computer toggle today)
- apps/web/src/app/games/[gameId]/page.tsx (only fetches multiplayer review via getReview)
- apps/web/src/services/game-review.service.ts (getReview)

Tasks:
1. ReviewRail: render PgnActions (copy/download PGN + FEN) inside the in-game right rail so it's
   available during/after a vs-computer game, not just post-game.
2. use-game-history: add a "vs computer" filter toggle (isVsComputer) to the query + returned list;
   surface it in the /games list UI (find the list page under apps/web/src/app/games and wire the
   toggle + a "vs Computer" badge on computer rows).
3. Deep-link review: branch games/[gameId]/page.tsx (and game-review.service.ts) so isVsComputer
   games resolve a review (fetch the computer game + build the review payload) instead of 404ing.
4. Vitest test under apps/web/test/games/: history filter narrows to vs-computer; the review service
   resolves a computer game.

Deliverables: filled review-rail.tsx + updated use-game-history.ts, games list, games/[gameId]/page.tsx,
game-review.service.ts + test; handoff at docs/roadmap/vs-computer-ui/session-08-handoff.md.

Quality gates: pnpm --filter @purechess/shared build; cd apps/web && pnpm typecheck && pnpm lint &&
pnpm exec vitest run test/.

Exit criteria: PGN/FEN actions appear in the live rail; /games filters vs-computer with a badge; a
computer-game deep link opens a review; tests pass.
```
