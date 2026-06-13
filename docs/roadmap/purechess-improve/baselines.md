# Improve epic — measurement baselines (Session 01)

Captured 2026-06-13 against the local dev stack (Next dev on :3000, NestJS dev
on :4000, Postgres + Redis healthy). These are the before-numbers later sessions
measure deltas against. Dev-server timings include cold-compile on first hit;
"warm" rows are steady-state.

## Existing daily-puzzle loop (reuse target, unchanged)

| Surface | Measurement | Value |
|---|---|---|
| `GET /api/puzzles/daily` (Redis-cached 24h) | total, 5 warm samples | 0.8–2.2 ms |
| `/puzzles` page (SSR shell) | TTFB / total, warm | ~13 ms / ~13 ms |
| `/puzzles` board-interactive | client hydrate + `usePuzzle` setup | timers 600/500/800 ms in `use-puzzle.ts`; board renders via the existing `<Chessboard>` (no second board) |

The daily puzzle is a public, DB-free Redis proxy; it stays as-is. Everything
new in this epic is DB-backed training **around** it.

## New Improve route shells (this session)

All three render the shared `TrainingPlaceholder` (Silent Tournament voice;
no new visual language). Signed-out renders the placeholder + a sign-in prompt;
no redirect. Verified HTTP 200, content present (headline + "Coming together").

| Route | HTTP | First-hit (dev cold-compile) | Auth | Empty-state |
|---|---|---|---|---|
| `/train` | 200 | ~0.39 s | needs auth for the plan/streak; placeholder always renders | "Train" hub: 10-min plan, calibrated puzzles, spaced review, mistakes-from-games, streaks. Signed-out → Sign in + "Try today's daily puzzle". |
| `/openings` | 200 | ~0.32 s | needs auth | "Openings": repertoire tree, PGN/explorer import, spaced drilling, out-of-book detection. |
| `/endgames` | 200 | 0.30 s | needs auth for progress | "Endgames": curated set by family, defend/convert vs perfect play, pass/fail, weakest-family surfacing. |

Empty-state copy is concrete (what the surface will do), never lorem. Each shell
cross-links the others + `/puzzles` via quiet pills.

## DB selection-query baseline

`EXPLAIN` on the hot puzzle-selection query against the empty `Puzzle` table:

```
EXPLAIN SELECT * FROM "Puzzle"
WHERE rating BETWEEN 1400 AND 1600 AND 'fork' = ANY(themes)
ORDER BY popularity DESC LIMIT 20;
-> Bitmap Index Scan on "Puzzle_rating_idx"  (rating range)
   Filter: 'fork' = ANY(themes)
```

Indexes present on `Puzzle`: `Puzzle_pkey`, `Puzzle_rating_idx` (B-tree),
`Puzzle_themes_idx` (GIN). At 0 rows the planner picks the rating B-tree; S02/S03
must re-run this after seeding 50k rows and confirm **no seq-scan** (DoD) —
p95 selection target < 80 ms at 50k.

## Targets (from the epic, for later sessions)

- Puzzle selection p95 < 80 ms at 50k puzzles.
- Solve page interactive < 1.5 s.
- Zero new layout shift on the board.
- Puzzle Glicko within ±100 of stable after ~30 solves.

## How to reproduce

```bash
# servers (host): pnpm dev   (or PORT-shifted per session-00 rules)
for i in 1 2 3; do curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://localhost:3000/puzzles; done
for r in train openings endgames; do curl -s -o /dev/null -w "/$r %{http_code} %{time_total}s\n" http://localhost:3000/$r; done
# EXPLAIN: run a node script from apps/api (so @prisma/client resolves):
#   const { PrismaClient } = require('@prisma/client');
#   await p.$queryRawUnsafe(`EXPLAIN SELECT ... FROM "Puzzle" ...`)
```
