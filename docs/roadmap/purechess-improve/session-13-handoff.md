# Session 13 handoff — Training hub, daily plan & streaks

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits, no S01 amendment
needed — `TrainingStreak` and `TrainingDay` were used read-as-designed.

## What was built

The front door: `/train` turns the pile of training tools into one daily habit —
a concrete ~10-minute plan aimed at the user's weakest thing, a streak that
rewards showing up, and a goal that's achievable daily.

1. **`StreakService`** (`apps/api/src/training/streak.service.ts`) — server-
   authoritative, UTC-day streaks via an **injected clock**. `recordActivity`,
   `get`, `setDailyGoal`. Exports pure date helpers
   (`dayKey`/`utcMidnight`/`sameUtcDay`/`isYesterdayUtc`).
2. **`Clock`** (`apps/api/src/training/clock.ts`) — the `CLOCK` provider token
   (`'TRAINING_CLOCK'`), `SYSTEM_CLOCK` in prod, pinned in specs. The streak math
   never calls `new Date()` directly.
3. **`StreakModule`** (`apps/api/src/training/streak.module.ts`) — depends only on
   Prisma + CLOCK; exports `StreakService`. Imported by the recorder modules so
   they can fire `recordActivity` without an import cycle (see §6).
4. **`TrainingService`** (`apps/api/src/training/training.service.ts`) —
   `getPlan(userId)` assembles today's plan from live signals;
   `progressToday(userId)` reports goal progress. Exports pure
   `assembleItems`/`trimToBudget`/`markDone`.
5. **`TrainingController`** (`apps/api/src/training/training.controller.ts`) —
   `GET /train/plan`, `GET /train/streak`, `POST /train/goal` (all
   `SessionAuthGuard` + `@CurrentUser`). `SetGoalBodyDto` (`dto/set-goal.dto.ts`,
   `class-validator` 1..50).
6. **`TrainingModule`** registered in `app.module.ts`; imports `AuthModule`,
   `PuzzlesModule`, `InsightsModule`, `StreakModule`.
7. **recordActivity hooks** into the four existing recorders (additive,
   `@Optional()`, best-effort — see §3).
8. **Shared DTOs** — `training.dto.ts`: `TrainingPlanItemDto` gained `kind:'daily'`
   + `target`/`doneToday` (optional, additive); new `SetTrainingGoalDto`. Rebuilt.
9. **Web hub** — `apps/web/src/app/train/`: `page.tsx` (server shell, parallel
   plan/streak/insight fetch), `train-client.tsx` (the hub).
   `components/training/`: `streak-banner.tsx`, `daily-plan.tsx`.
   `lib/api/training.ts` extended (`fetchTrainingPlan`/`fetchStreak`/
   `setTrainingGoal`).
10. **Tests** — `apps/api/test/training/streak.service.spec.ts` (13),
    `apps/api/test/training/training.service.spec.ts` (19),
    `apps/web/test/training/daily-plan.test.tsx` (13).
11. **OpenWolf** — cerebrum (2 Decision Log entries), anatomy (new files),
    memory, buglog (bug-560 circular-dep design note).

## 1. Quality gates — PASS/FAIL with actual final output

| Gate | Result | Final output line |
|---|---|---|
| `cd apps/api && pnpm exec tsc --noEmit` | **PASS** | `GATE1_API_TSC_EXIT=0` (clean, no output) |
| `cd apps/api && pnpm test` | **PASS** | `Test Suites: 47 passed, 47 total` / `Tests: 590 passed, 590 total` |
| `cd packages/shared && pnpm build` | **PASS** | `GATE3_SHARED_BUILD_EXIT=0` (clean) |
| `cd apps/web && pnpm exec tsc --noEmit` | **PASS** | `GATE4_WEB_TSC_EXIT=0` (clean, no output) |
| `cd apps/web && pnpm exec vitest run test/` | **PASS** | `Test Files  80 passed (80)` / `Tests  634 passed (634)` |

Also clean (definition-of-done): `cd apps/api && pnpm lint` → `API_LINT_EXIT=0`.

API tests 558 (S12) → **590** (+32: 13 streak + 19 training service). Web tests
621 (S12) → **634** (+13 daily-plan/streak-banner/train-client). The S13 specs in
isolation: `streak.service.spec.ts` → 13 passed; `training.service.spec.ts` → 19
passed; `daily-plan.test.tsx` → 13 passed.

## 2. Plan item schema + streak rules (incl. chosen day boundary)

### Plan item schema (`TrainingPlanItemDto`, `@purechess/shared`)

```ts
interface TrainingPlanItemDto {
  kind: 'daily' | 'theme' | 'review' | 'rush' | 'mistake' | 'opening' | 'endgame';
  label: string;          // imperative, e.g. "Solve 5 Forks puzzles"
  targetSlug?: string;    // theme/endgame slug the item targets
  count?: number;         // legacy alias of target
  target?: number;        // how many to complete today (item done when doneToday>=target)
  doneToday?: number;     // how many already done today (from the day's TrainingDay counters)
  estimatedMinutes?: number;
  href?: string;          // deep link to the drill (e.g. /puzzles/train?theme=fork)
  completed?: boolean;    // doneToday >= target
}

interface TrainingPlanDto {
  date: string;                  // YYYY-MM-DD (UTC)
  items: TrainingPlanItemDto[];
  dailyGoalPuzzles?: number;     // TrainingStreak.dailyGoalPuzzles
  puzzlesSolvedToday?: number;   // TrainingDay.puzzlesSolved
  estimatedMinutes?: number;     // sum over items
}
```

**Assembly (priority order, `TrainingService.assembleItems`):**
1. **`daily`** — the daily puzzle, only if NOT solved today (no
   `PuzzleAttempt{source:'daily', solved:true, createdAt in today-UTC}`). target 1.
2. **`theme`** — `THEME_PUZZLE_TARGET = 5` puzzles in
   `PuzzleHistoryService.summary().weakestTheme` (the high-confidence weakest
   theme; null when the user has too little signal).
3. **`review`** — `min(dueCount, REVIEW_TARGET_CAP=5)` due reviews
   (`PuzzleReviewService.dueCount`); omitted when nothing is due.
4. **`opening` | `endgame`** — ONE drill iff the **top insight**
   (`InsightsService.getInsights().weaknesses[0].kind`) is that kind; uses its
   `actionHref`. A theme/time top insight adds no drill (the theme is already
   item 2; time has no drill).

**~10-minute cap (`trimToBudget`, `PLAN_MINUTES_BUDGET = 10`):** per-item minute
costs `daily 2 / theme 5 / review 3 / opening|endgame 3`. Items are kept in
priority order until the next would exceed the budget; the first item is always
kept (a non-empty plan when there's work). Worked example: daily(2)+theme(5)+
review(3) = 10, so an opening(3) that would push to 13 is trimmed.

**Done-marking (`markDone`):** `TrainingDay` counters are AGGREGATE (the day's
total puzzles/reviews/drills), not per-item, so progress is attributed by kind in
priority order — `puzzlesSolved` fills `daily` then `theme`; `reviewsDone` fills
`review`; `drillsDone` fills `opening`/`endgame`. An item is `completed` once
`doneToday >= target`.

### Streak rules + day boundary

**Day boundary = UTC** (`dayKey = date.toISOString().slice(0,10)`; stored at
UTC-midnight to match the frozen `@db.Date` columns). Chosen over user-local for:
(1) consistency with `bucketDailyClose` (S11) and the frozen
`TrainingDay.day`/`TrainingStreak.lastTrainedOn` columns; (2) no trusted client
timezone — a streak can't be gamed by spoofing the local clock
(server-authoritative, operator rule); (3) test determinism via the injected
clock. Cost: a player near UTC-midnight sees the day flip mid-evening — the right
trade for a global, untrusted, scored streak. (A future per-user-tz refinement
stores the tz and shifts the key — no schema change needed.)

**`recordActivity(userId, kind, count=1)`** (`kind ∈ {puzzle, review, drill}`):
- Upserts today's `TrainingDay`, incrementing the kind's counter by `count`
  (`puzzle→puzzlesSolved`, `review→reviewsDone`, `drill→drillsDone`).
- Advances `TrainingStreak` **at most once per UTC day**. "First activity today"
  is decided by checking `TrainingDay` existence BEFORE the upsert:
  - first-ever activity → `currentStreak = 1`;
  - first activity of a day whose previous active day was **yesterday** →
    `currentStreak + 1`;
  - first activity after a **gap** (last active day before yesterday) → reset to
    `1`;
  - a 2nd+ action the SAME day → counter increments, streak unchanged (no double
    count).
  - `longestStreak = max(longestStreak, currentStreak)`.

`get(userId)` → `TrainingStreakDto` (current/longest/lastTrainedOn/
dailyGoalPuzzles/goalMetToday + 84-day `history` for the calendar); creates no
rows for a never-trained user (zeroed default, goal 10). `setDailyGoal` upserts,
clamped 1..50.

## 3. The recordActivity hook points (S14 adaptive reads recent performance here)

Each is a SINGLE additive, best-effort hook via an `@Optional()`-injected
`StreakService` (try/catch — a streak write never fails the underlying action,
mirroring S06's enqueue pattern). S14 adaptive difficulty reads recent
performance from these same recorders:

| Recorder (file) | Hook fires when | Activity kind |
|---|---|---|
| `PuzzleServingService.recordAttempt` (`puzzle-serving.service.ts`) | `input.solved === true` (any mode: theme/daily/rush/mistake) | `puzzle` |
| `PuzzleReviewService.grade` (`puzzle-review.service.ts`) | a real card was graded (solved OR failed; the no-op "not queued" early return is skipped) | `review` |
| `EndgamesService.recordAttempt` (`endgames.service.ts`) | any endgame attempt recorded | `drill` |
| `RepertoireReviewService.grade` (`repertoire-review.service.ts`) | an opening line is graded | `drill` |

A SOLVED puzzle (not a failed one) drives the streak — failures already route to
the spaced-repetition queue; the streak rewards completing work, and a review/
drill counts regardless of pass/fail (you showed up). The per-kind `TrainingDay`
counters (`puzzlesSolved`/`reviewsDone`/`drillsDone`) are S14's read surface for
"what did the user do recently".

## 4. New REST surface + web client

| Method | Path | Body | Returns |
|---|---|---|---|
| `GET` | `/train/plan` | — | `TrainingPlanDto` |
| `GET` | `/train/streak` | — | `TrainingStreakDto` |
| `POST` | `/train/goal` | `SetGoalBodyDto {dailyGoalPuzzles}` | `TrainingStreakDto` |

(All `SessionAuthGuard`. `GET /train/insights` from S12 stays on the sibling
`InsightsController` — same `/train` prefix, separate controller.)

Web client (`apps/web/src/lib/api/training.ts`, `credentials:'include'`):
`fetchTrainingPlan()`, `fetchStreak()`, `setTrainingGoal(n)`.

## 5. /train hub UI

- **`StreakBanner`** — current streak (flame) + longest (trophy) + a 12-week
  contribution calendar (`grid-rows-7`, brass-opacity band by daily activity
  count). `buildCalendar(history, total)` pure: oldest-first cells ending today.
- **`DailyPlan`** — ordered checklist; each row a brass CTA to its `href`, an
  `N/target` progress line, a strike + success tick when complete. A SVG goal
  ring fills as the day's puzzle goal is met (success state at goal). A quiet
  "Done for today" banner once every item is complete. Empty state when no items.
- **`TrainClient`** — assembles StreakBanner + a one-line **Focus** from the top
  insight (`title` — evidence → "Fix this", links to `actionHref`) + DailyPlan +
  a grid of 8 mode tiles (Daily, Train by theme, Rush, Review (due badge =
  review-item `target − doneToday`), Openings, Endgames, Stats, Insights).
  Signed out → sign-in pitch + a daily-puzzle link (no account needed).
- No new visual language (design.md): radius 10/12, the single brass accent,
  `text-brass-text`/`text-brass-foreground`, lucide icons.

## 6. Module layout — avoiding the import cycle (decision)

`TrainingModule` imports `PuzzlesModule` (history/review). If `StreakService`
were exported from `TrainingModule`, then `PuzzlesModule` importing
`TrainingModule` to inject it would close a cycle
(`TrainingModule → PuzzlesModule → TrainingModule`). **Fix:** the streak recorder
lives in its own **`StreakModule`** that depends ONLY on Prisma + the CLOCK
provider (no training/insights/puzzle services), so the recorder modules
(`PuzzlesModule`, `EndgamesModule`, `RepertoireModule`) import it acyclically.
`TrainingModule` also imports it for `get`/`setDailyGoal`. `StreakService` is
`@Optional()`-injected into the four recorders so their isolated unit specs (which
provide no StreakModule) still pass byte-for-byte (no streak mock → no-op hook).
Logged as `bug-560`.

## 7. Deviations + notes

- **Plan item schema gained `target`/`doneToday`** (the spec's
  `{kind,label,href,target,doneToday}` shape) ALONGSIDE the pre-existing
  `count`/`completed` — all optional, additive per S00. The UI reads
  `target ?? count` and `completed`.
- **A SOLVED puzzle drives the streak, not a failed attempt.** Failures already
  enqueue for review; the streak rewards completed work. Reviews/drills count
  regardless of pass/fail. Documented in cerebrum.
- **Daily "solved today" = a source-tagged attempt**, not a separate flag — a
  `PuzzleAttempt{source:'daily', solved:true}` within today's UTC window. The
  daily controller records attempts via `recordAttempt` with `source:'daily'`.
- **`TrainingService` has its own CLOCK provider** (same `SYSTEM_CLOCK`) so the
  plan's "today" is testable; `StreakModule` provides CLOCK for the recorder.
- **No WS, no schema change, no engine-path import** — training code is entirely
  outside `apps/api/src/chess/engine/`; the coverage gate is untouched.
- **No new DB hot query against `Puzzle`.** The new reads are: `trainingDay`
  `findUnique`/`upsert` on the `@@unique([userId, day])`; `trainingDay.findMany`
  (`where userId, day >= since`, ≤84 rows) on `[userId, day]`;
  `trainingStreak.findUnique`/`upsert` on the PK `userId`; one
  `puzzleAttempt.count` (`userId, source:'daily', solved, createdAt window`) on
  the existing `[userId, createdAt]` index. The plan's heavy aggregates are
  delegated to the existing S11/S12/S06 services (summary, insights cache, due
  count). No seq-scan on the 50k `Puzzle` bank → S01 index plan unaffected;
  EXPLAIN not re-run (no new query shape touches `Puzzle`).

## Inputs for dependent sessions (S14 — adaptive difficulty)

- **Recent performance signal:** read the `TrainingDay` counters
  (`puzzlesSolved`/`reviewsDone`/`drillsDone`) and the streak via
  `StreakService.get(userId)` / `recordActivity`. The four hook points in §3 are
  where a per-attempt difficulty adjustment would also tap in (they already see
  every solved puzzle / graded review / drill).
- **Plan assembly** is `TrainingService.assembleItems` (pure given its inputs) —
  to add an adaptive item, add a branch there and a minute cost to `MINUTES`; the
  budget trim + done-marking are kind-agnostic.
- **Injected clock** (`CLOCK` token, `apps/api/src/training/clock.ts`) — any new
  time-dependent training logic should inject it, never `new Date()`.
- **Exported constants** to tune: `THEME_PUZZLE_TARGET`, `REVIEW_TARGET_CAP`,
  `PLAN_MINUTES_BUDGET` (training.service.ts); `CALENDAR_DAYS`,
  `DEFAULT_DAILY_GOAL` (streak.service.ts).

**Commit:** see the S13 commit on `epic/purechess-improve` (message
`feat(improve): S13 training hub, daily plan & streaks`).
