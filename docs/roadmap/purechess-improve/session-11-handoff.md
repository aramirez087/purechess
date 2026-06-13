# Session 11 handoff — Puzzle stats & charts

**Status:** complete, all four quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits, no S01 amendment needed.

## What was built

1. **`PuzzleHistoryService`** (`apps/api/src/puzzles/puzzle-history.service.ts`) —
   `ratingHistory(userId)` (capped + daily-close-bucketed rating curve) and
   `summary(userId)` (headline numbers + weakest theme). Exports two pure
   helpers: `bucketDailyClose` and `selectWeakestTheme`.
2. **`GET /puzzles/history`** — additive route on the EXISTING
   `PuzzleTrainingController` (same `@Controller('puzzles')`, `SessionAuthGuard`
   + `@CurrentUser`). Returns `{ ratingHistory, summary }`. Service registered as
   a provider+export in `puzzles.module.ts` (single additive edit).
3. **Shared DTOs** (`packages/shared/src/dto/puzzle.dto.ts`) — `PuzzleRatingPointDto`,
   `PuzzleSummaryDto`, `PuzzleHistoryDto` (all new fields optional-friendly).
4. **Web client** — `fetchPuzzleHistory()` added to `apps/web/src/lib/api/puzzles.ts`.
5. **`PuzzleRatingChart`** (`apps/web/src/components/puzzle/puzzle-rating-chart.tsx`)
   — reuses the profile rating-chart's pure-SVG visual language; single series;
   empty state.
6. **`ThemeAccuracyTable`** (`apps/web/src/components/puzzle/theme-accuracy-table.tsx`)
   — weakest-first rows, accuracy bar via the shared color scale, ⚠ under 50%,
   each row deep-links into `/puzzles/train?theme=<slug>`. Exports pure
   `sortWeakestFirst`.
7. **`/puzzles/stats`** — server `page.tsx` (auth + history/stats fetch) +
   `stats-client.tsx` (big rating, accuracy summary, "Practice [weakest]" brass
   CTA, chart, table; signed-out sign-in prompt).
8. **Profile puzzle stat** — `components/profile/puzzle-rating-pill.tsx`
   (self-fetching client pill, additive); mounted in `profile/[username]/page.tsx`
   only when `isOwnProfile`. Game ratings untouched.
9. **Tests** — `apps/web/test/puzzle/theme-accuracy-table.test.tsx` (8 cases) +
   `apps/api/test/puzzles/puzzle-history.service.spec.ts` (13 cases).
10. **OpenWolf** — cerebrum (chart reuse, history bucketing, weakest selector,
    vitest two-render gotcha), anatomy, memory, buglog (549/550).

## 1. Quality gates — all PASS

| Gate | Command | Final output line |
|---|---|---|
| API tsc | `cd apps/api && pnpm exec tsc --noEmit` | exit 0 (clean, `API_TSC_CLEAN`) |
| API tests | `cd apps/api && pnpm test` | `Test Suites: 44 passed, 44 total` / `Tests: 518 passed, 518 total` |
| Web tsc | `cd apps/web && pnpm exec tsc --noEmit` | exit 0 (clean, `WEB_TSC_EXIT=0`) |
| Web tests | `cd apps/web && pnpm exec vitest run test/` | `Test Files 79 passed (79)` / `Tests 621 passed (621)` |

API tests went 502 → **518** (the 13 new history-service cases + watcher).
Web tests went 613 → **621** (the 8 new theme-accuracy-table cases).
API lint (`cd apps/api && pnpm lint`) also clean (exit 0).

## 2. `summary()` shape (S12/S13 consume this) + weakest-theme selector

`PuzzleSummaryDto` (in `@purechess/shared`):

```ts
interface PuzzleSummaryDto {
  puzzleRating: number;            // current puzzle Glicko, Math.round
  attempted: number;              // total PuzzleAttempt rows for the user
  solved: number;                 // total solved rows
  accuracy?: number;              // solved/attempted, 0..1; undefined at 0 attempts
  weakestTheme?: PuzzleThemeStatDto | null; // the one theme to drill next, or null
}
```

`GET /puzzles/history` returns `PuzzleHistoryDto = { ratingHistory: PuzzleRatingPointDto[]; summary: PuzzleSummaryDto }`.
`PuzzleRatingPointDto = { rating: number; at: string /* ISO */ }`.

**Weakest-theme selector** — `selectWeakestTheme(stats)` (exported pure from
`puzzle-history.service.ts`):
- Eligibility floor: theme must have **≥ 5 attempts** and a defined accuracy.
  Below the floor a one-off miss on a rare theme can't masquerade as the user's
  biggest weakness.
- Sort: **accuracy ASC** (weakest first); tie-break **larger sample first**
  (more confident the weakness is real), then **slug** (deterministic).
- Returns the first eligible theme, or `null` when none qualifies.

This is STRICTER than the table's ordering: the `ThemeAccuracyTable` shows
*every* attempted theme weakest-first (`sortWeakestFirst`, only drops 0-attempt
themes), but the summary/CTA picks the single high-confidence weakness. Both
mirror the server `getStats` ASC ordering the rest of the epic relies on.

## 3. `ratingHistory` bucketing approach + the cap

`PuzzleAttempt.ratingAfterUser` (Int?, `[userId, createdAt]` index) is the
per-attempt rating trail — there is **no** dedicated rating-history table (S03
handoff confirmed this). The curve is derived in two bounded steps:

1. **Hard read cap = 200.** Pull the user's **newest ≤ 200** attempts with a
   non-null `ratingAfterUser` (`orderBy createdAt desc, take 200`), then reverse
   to oldest-first. This bounds the DB read and the raw point count even for a
   user with tens of thousands of attempts (`MAX_RATING_POINTS = 200`).
2. **Daily-close bucketing.** `bucketDailyClose` collapses attempts on the same
   **UTC calendar day** (`at.toISOString().slice(0,10)`) into a single
   day's-close point (the last attempt of that day wins; ratings rounded). A
   user who solves 300 puzzles in one day contributes **one** point for that
   day, not 300.

Net: the series length is at most `min(200, distinctDays)` — bounded and
readable while preserving the newest movement. Empty `[]` when the user has no
rated attempts.

**Tests proving the cap** (`puzzle-history.service.spec.ts`):
- asserts `findMany` is called with `take: 200` (and `orderBy createdAt desc`);
- 200 distinct days ⇒ series length ≤ 200;
- **300 attempts on a single day ⇒ exactly 1 point** (the day's close);
- pure `bucketDailyClose`: 1000 points across 7 days ⇒ ≤ 7 points; last-of-day
  wins; fractional ratings rounded.

## 4. Repository inputs for dependent sessions

- **S12 (weakness insights):** consume `PuzzleSummaryDto.weakestTheme` /
  `selectWeakestTheme` from `apps/api/src/puzzles/puzzle-history.service.ts`, or
  call `GET /puzzles/history` / `fetchPuzzleHistory()`. The full per-theme
  roll-up is still `PuzzleServingService.getStats` (accuracy ASC).
- **S13 (training hub):** `PuzzleHistoryService.summary(userId)` is the headline
  card source (rating + accuracy + weakest theme). The service is exported from
  `PuzzlesModule`, so inject it directly. The compact profile stat pattern is
  `components/profile/puzzle-rating-pill.tsx` (self-fetching, additive).
- **Chart reuse:** `apps/web/src/components/puzzle/puzzle-rating-chart.tsx` takes
  `PuzzleRatingPointDto[]`; copy it (pure SVG, no chart lib) for any future
  series — never add a chart dependency.

## 5. Deviations + decisions

- **"Reuse the recharts chart" → reuse the pure-SVG `rating-chart.tsx`.** There
  is no recharts in the repo; the existing profile chart is zero-dep SVG. The
  binding constraint (operator rules) is "do NOT add a new chart lib", which is
  honored — `puzzle-rating-chart.tsx` mirrors the SVG approach exactly. No new
  dependency added.
- **Profile stat is a client-fetched pill, not a `ProfileDto` field.** Adding a
  `puzzleRating` to `ProfileDto`/`users.service` would touch game-rating plumbing
  and risk the "don't disturb game ratings" rule. A self-contained client pill
  (`fetchPuzzleRating` on mount, render-null until loaded) is fully additive and
  needs no schema/service change. Shown only on the own profile.
- **`weakestTheme` floor (≥5 attempts) is intentionally stricter than the
  table.** The table lists all attempted themes weakest-first; the CTA/summary
  surfaces one *confident* weakness. Documented above.
- **No new WS events** — this epic surface is request/response only (operator
  rule check: none needed).
- **No DB hot-query EXPLAIN** — `ratingHistory` is a bounded `findMany`
  (`take:200`) on the existing `[userId, createdAt]` index; `summary` is two
  `count`s on `[userId]` + the existing `getStats` roll-up. No new query shape
  hits `Puzzle`, so the S01 index plan is unaffected.

## 6. Open issues

- The accuracy bar uses the 16%-alpha `acc-bg-*` wash (the shared S01 scale), so
  the bar fill is subtle by design; the solid `acc-*` percentage carries the
  signal. If a stronger bar is wanted later, add a solid `acc-fill-*` utility to
  globals.css (S01-owned file) rather than hardcoding hues.

**Commit:** see the S11 commit on `epic/purechess-improve` (message
`feat(improve): S11 puzzle stats & charts`).
