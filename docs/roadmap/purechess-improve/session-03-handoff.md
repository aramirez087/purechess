# Session 03 handoff — Puzzle serving API + puzzle Glicko rating

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits.

## What was built

1. **`PuzzleRatingService`** (`apps/api/src/puzzles/puzzle-rating.service.ts`) —
   per-user puzzle Glicko-2. `applyResult` reuses the EXISTING `updateRating`
   from `apps/api/src/ratings/glicko2.ts` verbatim (no extraction needed — it
   was already pure + exported). `get` returns the snapshot or defaults.
2. **`PuzzleServingService`** (`apps/api/src/puzzles/puzzle-serving.service.ts`) —
   `getNext` (rating-window ladder + unseen exclusion + theme filter, raw
   parameterized SQL), `recordAttempt` (insert + rating + plays bump + delta),
   `getStats` (per-theme accuracy, weakest first).
3. **`PuzzleTrainingController`** (`apps/api/src/puzzles/puzzle-training.controller.ts`)
   — 5 routes, registered **additively** in `puzzles.module.ts`. Daily puzzle
   (`GET /puzzles/daily`) untouched.
4. **`RecordAttemptDto`** (`apps/api/src/puzzles/dto/record-attempt.dto.ts`) —
   class-validator body for the attempt POST.
5. **Web client** (`apps/web/src/lib/api/puzzles.ts`) — five typed fns
   extending the existing daily-puzzle client.
6. **Tests** — `puzzle-serving.service.spec.ts` (16 cases),
   `puzzle-rating.service.spec.ts` (8 cases incl. the pinned game-rating vector).
7. **OpenWolf** — cerebrum (serving ladder + Glicko-reuse), anatomy, memory.

## 1. Quality gates — all PASS

| Gate | Command | Final output line |
|---|---|---|
| API tsc | `cd apps/api && pnpm exec tsc --noEmit` | exit 0 (clean, `API_TSC_CLEAN`) |
| API tests | `cd apps/api && pnpm test` | `Test Suites: 36 passed, 36 total` / `Tests: 405 passed, 405 total` |
| Shared build | `cd packages/shared && pnpm build` | `tsc --project tsconfig.json` (exit 0) |
| Web tsc | `cd apps/web && pnpm exec tsc --noEmit` | exit 0 (clean, `WEB_TSC_CLEAN`) |

API tests went 381 → **405** (the 24 new puzzle-serving + puzzle-rating cases).
Live-verified against 400 seeded synthetic puzzles (cleaned up afterward, not
committed): `GET /api/puzzles/themes` → 200 with the real theme histogram;
`GET /api/puzzles/next|stats|rating` → 401 unauthenticated; `GET
/api/puzzles/daily` → 200 (untouched).

## 2. Endpoints — request / response shapes

All under `@Controller('puzzles')` → `/api/puzzles/*`. Auth = the
`SessionAuthGuard` (cookie `purechess_session`) + `@CurrentUser() user: User`,
matching the existing matchmaking/users controllers.

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/puzzles/themes` | **public** | — | `PuzzleThemeDto[]` `{ slug, label, puzzleCount }` (label = slug; from `PuzzleCatalogService.listThemes`) |
| GET | `/puzzles/next` | guard | query `?theme=&rating=` (both optional) | `PuzzleDto` `{ id, fen, moves[], rating, ratingDeviation, popularity, plays, themes[], openingTags[] }` |
| POST | `/puzzles/:id/attempt` | guard | body `RecordAttemptDto { solved: boolean; msToSolve?: number; source?: 'theme'\|'daily'\|'rush'\|'review'\|'mistake' }` | `PuzzleAttemptResultDto` `{ puzzleId, solved, ratingBefore, ratingAfter, ratingDelta }` (HTTP 200) |
| GET | `/puzzles/stats` | guard | — | `PuzzleThemeStatDto[]` `{ slug, attempts, solved, accuracy?, avgMsToSolve?, lastAttemptedAt? }`, **accuracy ASC** |
| GET | `/puzzles/rating` | guard | — | `PuzzleRatingDto` `{ rating, deviation?, volatility?, updatedAt? }` |

`recordAttempt` errors: 404 `NotFoundException` for an unknown puzzle id (the
rating engine is never touched in that path). `getNext` errors: 404 only when
even the final dropped-filter tier is empty.

## 3. `getNext` fallback tiers + attempted-puzzle exclusion

**Target rating resolution:** explicit `rating` arg → the user's
`PuzzleRating.rating` → `1500`.

**Ladder** (first non-empty wins; the firing tier is logged via `Logger`):

| Tier | Rating window | Unseen filter | Theme filter |
|---|---|---|---|
| 0 | `[target-150, target+150]` | excluded | applied if given |
| 1 | `[target-300, target+300]` | excluded | applied if given |
| 2 | `[target-600, target+600]` | excluded | applied if given |
| final | **dropped** (no rating bound) | **dropped** | **kept** if given |

If the final tier is still empty → `NotFoundException`.

**Exclusion implementation — raw parameterized SQL (not Prisma's query
builder).** The WHERE clause is assembled from composable `Prisma.sql`
fragments joined with `Prisma.join(conds, ' AND ')`, so it is fully
parameterized regardless of which filters are active. The unseen filter is a
correlated `NOT EXISTS` subquery:

```sql
SELECT p.id, p.fen, p.moves, p.rating, p."ratingDeviation",
       p.popularity, p.plays, p.themes, p."openingTags"
FROM "Puzzle" p
WHERE p.rating BETWEEN $min AND $max          -- tiers 0..2 only
  AND p.themes @> ARRAY[$theme]::text[]        -- when a theme is given (GIN)
  AND NOT EXISTS (                             -- excludeSeen tiers
    SELECT 1 FROM "PuzzleAttempt" a
    WHERE a."puzzleId" = p.id AND a."userId" = $userId
  )
ORDER BY random()
LIMIT 1
```

Why raw, not Prisma: Prisma's builder can't cleanly combine `themes @>
ARRAY[...]` containment, a correlated NOT-EXISTS, and `ORDER BY random() LIMIT
1` in one query. All inputs (`$min/$max/$theme/$userId`) are bound params — no
string interpolation.

**EXPLAIN at the 400-row sample** (re-run after the production 50k seed per S01
DoD): the planner seq-scans `Puzzle` (table too small for the rating B-tree to
win) and does a **Hash Anti Join** for the exclusion via
`PuzzleAttempt_userId_createdAt_idx` — the intended NOT-EXISTS plan. The rating
B-tree / themes GIN only win once the bank is large + the filter is selective.

```
Limit
  ->  Sort (Sort Key: random())
        ->  Hash Anti Join (Hash Cond: p.id = a."puzzleId")
              ->  Seq Scan on "Puzzle" p  (Filter: rating>=1350 AND rating<=1650)
              ->  Hash -> Bitmap Heap Scan on "PuzzleAttempt" a
                    ->  Bitmap Index Scan on "PuzzleAttempt_userId_createdAt_idx"
```

## 4. Reused Glicko helper — EXACT import path + non-regression proof

**Import path (for S11's rating chart, S04's solve loop, and anyone else):**

```ts
import { updateRating, DEFAULT_RATING, type GlickoRating } from '../ratings/glicko2';
// from apps/api/src/puzzles/* the relative path is '../ratings/glicko2'
```

`updateRating(player: GlickoRating, games: GlickoGame[]): GlickoRating` was
**already pure and exported** — no extraction or refactor of `RatingsService`
was needed, so game-rating behavior is byte-for-byte unchanged. A puzzle is
modeled as one Glicko game: `opponent = { rating: Puzzle.rating, ratingDeviation:
Puzzle.ratingDeviation, volatility: 0.06 }`, `score = solved ? 1 : 0`.

**Game ratings provably unchanged — the pinned vector** (Glickman's worked
example, 1500/200/0.06 vs three opponents win/loss/loss):

```
result.rating            ≈ 1464.06
result.ratingDeviation   ≈ 151.52
result.volatility        ≈ 0.05999
```

This vector is asserted in BOTH `apps/api/test/ratings/glicko2.spec.ts` (pre-
existing) and `apps/api/test/puzzles/puzzle-rating.service.spec.ts` (new, the
`game-rating non-regression` describe block) — a change to the shared engine
breaks both suites.

**Note:** `PuzzleRating` columns are **Float** (vs the game `Rating`'s Int), so
the service stores the unrounded Glicko values; only the DTO/`PuzzleAttempt`
snapshots are rounded for display. New users default to 1500/350/0.06. A puzzle
with `ratingDeviation = 0` (possible on a sparse seed) is clamped to 60 so the
variance term can't collapse.

## 5. Web client fn signatures (`apps/web/src/lib/api/puzzles.ts`)

Auth-gated calls carry `credentials: 'include'`; shapes are the real
`@purechess/shared` DTOs (imported at file top).

```ts
fetchThemes(): Promise<PuzzleThemeDto[]>                         // public
fetchNextPuzzle(opts?: { theme?: string; rating?: number }): Promise<PuzzleDto>
recordAttempt(
  puzzleId: string,
  body: { solved: boolean; msToSolve?: number; source?: PuzzleSource },
): Promise<PuzzleAttemptResultDto>
fetchPuzzleStats(): Promise<PuzzleThemeStatDto[]>
fetchPuzzleRating(): Promise<PuzzleRatingDto>
```

The existing `getDailyPuzzle()` + `LichessPuzzleData` type are untouched.

## 6. Deviations + commit

**Deviations from the spec:** essentially none. Notes:

- **No Glicko extraction performed.** The spec said "if they're private to
  `RatingsService`, extract a shared pure helper." They were already in a
  standalone pure module (`ratings/glicko2.ts`) and exported, so the cleaner
  path was to import them directly — zero risk to game ratings. The
  non-regression test is still added (pins the paper vector in the puzzle
  rating spec).
- `RecordAttemptDto.source` is **optional** and defaults to `'theme'`
  server-side (the spec body listed `source` without a required marker; theme
  trainer is the S03 surface).
- `getNext`'s explicit `rating` query param is parsed/validated in the
  controller (finite-number guard) before reaching the service.
- `PuzzlesModule` now `imports: [AuthModule]` (needed for `SessionAuthGuard` +
  `SessionsService`); Prisma/Redis come from the `@Global` Database/Redis
  modules so they need no import.

**Inputs for dependent sessions:**

- **S04 (solve loop):** call `serving.getNext` / `serving.recordAttempt`
  server-side, or the web fns `fetchNextPuzzle` / `recordAttempt` from
  `apps/web/src/lib/api/puzzles.ts`. The first move of `PuzzleDto.moves` is the
  opponent's setup move (lichess convention); the solver plays from index 1.
- **S11 (rating chart):** reuse `updateRating` from `apps/api/src/ratings/glicko2.ts`
  and read `GET /puzzles/rating`. `PuzzleRating` carries `updatedAt` only (no
  per-attempt rating history table — `PuzzleAttempt.ratingBeforeUser/After` is
  the per-attempt trail if a sparkline is needed).
- **Seed the bank** (`pnpm db:seed-puzzles <csv> --count 50000`) before any
  live selection-query work — the live DB is currently empty (sample cleaned
  up). **Re-run the `getNext` EXPLAIN after the 50k seed** to confirm no
  seq-scan at scale and p95 < 80 ms (S01 DoD).

**Commit:** `76f9142` on `epic/purechess-improve`.
