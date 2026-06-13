# Session 06 handoff — Spaced-repetition review

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits — the
`PuzzleReview` table from S01 was used read-as-designed.

## What was built

1. **`spaced-repetition.ts`** (`apps/api/src/puzzles/spaced-repetition.ts`) —
   a PURE, deterministic SM-2 scheduler. No DB, no side effects, does not
   mutate its input. `schedule(prev, grade)` → next card state + `nextDueOffsetDays`.
2. **`PuzzleReviewService`** (`apps/api/src/puzzles/puzzle-review.service.ts`) —
   the queue over `PuzzleReview`: `enqueueOnFail`, `getDue`, `dueCount`,
   `nextDueAt`, `grade`, `getDuePayload`.
3. **Enqueue-on-fail hook** in `PuzzleServingService.recordAttempt` — additive,
   best-effort, via an `@Optional()`-injected `PuzzleReviewService`.
4. **`PuzzleReviewController`** (`apps/api/src/puzzles/puzzle-review.controller.ts`)
   + **`GradeReviewDto`** — `GET /puzzles/review/due`, `POST /puzzles/review/:id/grade`,
   registered additively in `puzzles.module.ts`.
5. **Shared DTOs** — `ReviewDueDto`, `ReviewGradeResultDto` in `puzzle.dto.ts`.
6. **Web client** — `fetchDueReviews` + `gradeReview` in `apps/web/src/lib/api/puzzles.ts`.
7. **`/puzzles/review`** server page + `review-client.tsx` — a thin
   `useLocalPuzzle` loop over the due queue (NOT `TrainingSession`), with a calm
   "All caught up" empty state and an end-of-queue summary.
8. **Tests** — `spaced-repetition.spec.ts` (15 cases),
   `puzzle-review.service.spec.ts` (13 cases, mocked Prisma).
9. **OpenWolf** — cerebrum (Decision Log S06 entry), anatomy (new + edited
   files), memory.

## 1. Quality gates — all PASS

| Gate | Command | Final output line |
|---|---|---|
| API tsc | `cd apps/api && pnpm exec tsc --noEmit` | exit 0 (clean) |
| API tests | `cd apps/api && pnpm test` | `Test Suites: 39 passed, 39 total` / `Tests: 441 passed, 441 total` |
| Web tsc | `cd apps/web && pnpm exec tsc --noEmit` | exit 0 (clean) |
| Web tests | `cd apps/web && pnpm exec vitest run test/` | `Test Files  74 passed (74)` / `Tests  584 passed (584)` |

API tests went 405 (S03) → 423 (S05) → **441** (the 28 new
spaced-repetition + puzzle-review cases). Web tests **584 passing**, including
the S04 `test/puzzle/training-session.test.tsx (4)` — **green, unchanged**
(see §4). The S04 daily-puzzle suites and the S05 rush suites also stay green.

## 2. `dueCount()` signature + the enqueue-on-fail wiring point

### `dueCount` (S13 hub badge consumes this)

```ts
// apps/api/src/puzzles/puzzle-review.service.ts
dueCount(userId: string): Promise<number>
```

Counts `PuzzleReview` rows where `dueAt <= now` for the user, via the
`@@index([userId, dueAt])`. It is also exported from `PuzzlesModule`
(`exports: [... PuzzleReviewService]`), so S13 can inject `PuzzleReviewService`
directly and call `dueCount(user.id)` for the badge — no new endpoint required
(though `GET /puzzles/review/due` also returns `dueCount` in its payload if a
fetch is more convenient).

### Enqueue-on-fail wiring point

`PuzzleServingService.recordAttempt` (`apps/api/src/puzzles/puzzle-serving.service.ts`).
After the `PuzzleAttempt` is written and `plays` bumped, **before the return**:

```ts
if (!input.solved && this.reviewService) {
  try {
    await this.reviewService.enqueueOnFail(userId, puzzleId);
  } catch (err) {
    this.logger.warn(`enqueueOnFail failed ...`); // best-effort
  }
}
```

`PuzzleReviewService` is injected `@Optional()` so the existing
`puzzle-serving.service.spec.ts` (which provides no review mock) still compiles
and passes byte-for-byte — its `solved: false` test now simply skips the enqueue
(no mock → `this.reviewService` is `undefined`). In the wired app `PuzzlesModule`
always provides it. This means **every mode** that records a failed attempt
through `recordAttempt` (theme trainer S04, rush S05, daily, and S07 mistakes if
it routes through serving) auto-enqueues for review. The enqueue is best-effort:
a queue write failing never changes the attempt outcome or the returned rating
delta.

## 3. Graduation rule + SM-2 constants

**Graduation rule:** a card whose post-grade `intervalDays > 30` is **deleted**
from `PuzzleReview` — it's "learned" and leaves the queue for good.
`GRADUATION_INTERVAL_DAYS = 30` is exported from `puzzle-review.service.ts`
(Anki's "mature card" convention; a tactic you can reproduce a month later is no
longer the bottleneck). A failed grade can never graduate (it lapses to ~1 day).

**SM-2 constants** (all exported from `spaced-repetition.ts`, documented inline):

| Constant | Value | Meaning |
|---|---|---|
| `DEFAULT_EASE` | 2.5 | starting ease for a new card |
| `MIN_EASE` | 1.3 | ease floor — never drops below |
| `FIRST_INTERVAL_DAYS` | 1 | interval after the 1st success |
| `SECOND_INTERVAL_DAYS` | 6 | interval after the 2nd success |
| `LAPSE_INTERVAL_DAYS` | 1 | interval a failed card collapses to |
| `AGAIN_EASE_PENALTY` | 0.2 | ease drop on a lapse (`again`) |
| `GOOD_EASE_DELTA` | 0 | ease held flat on a normal success |
| `EASY_EASE_BONUS` | 0.15 | ease bump on a confident success |
| `EASY_BONUS` | 1.3 | extra interval multiplier on `easy` |

Grade mapping (in `PuzzleReviewService.grade`): fail → `again`; solve → `good`,
or **`easy` when `msToSolve < 8000` ms** (`EASY_MS_THRESHOLD`, service-local).
Interval ladder on success: rep 1 → 1d, rep 2 → 6d, rep ≥3 → `round(prev × ease)`;
`easy` additionally ×1.3. Worked example streak (`good`,`good`,`good`,`good`):
`1, 6, 15, 38` days. A lapse resets `reps→0`, `lapses+1`, `interval→1`,
`ease −0.2` (floored 1.3).

## 4. How due puzzles feed the solve loop (+ S04 non-regression)

**Decision: a thin review loop reusing `useLocalPuzzle` — NOT a `TrainingSession`
prop change.** `review-client.tsx`'s `ReviewRun` pre-fetches the fixed due queue
(server-rendered into `initialDue`), then feeds it one puzzle at a time into
`useLocalPuzzle`, exactly like Puzzle Rush (S05) does. On each solve/fail it
calls **`gradeReview(id, {solved, msToSolve})`** (NOT the normal
`recordAttempt` path) so the SM-2 reschedule is the only write. Header shows
`N due`; 1.2s auto-advance; end-of-queue `ReviewSummary` (solved/total + next
review date).

**Why not the `fetchPuzzle` prop on `TrainingSession` (the S04-flagged option):**
`TrainingSession` is built for a *stream* (`fetchNextPuzzle` per puzzle, target =
solve count, theme-accuracy before/after summary). Review is a *fixed finite
queue* graded by a different endpoint with a graduation outcome — bending the
shell to fit would have meant several conditional props. The rush precedent
(also a fixed pre-fetched set) already established the thin-loop pattern, so
review follows it. **`TrainingSession` was left completely untouched.**

**S04 tests still pass:** `test/puzzle/training-session.test.tsx (4)` is green in
the web run above (`584 passed`). Because `TrainingSession`, `useLocalPuzzle`,
and `recordAttempt`'s shape were not modified, the S04 contract is intact.

## 5. IMPORTANT for S07 (mistakes) — `getDue` data source + extensibility

**`getDue`'s data source is a single Prisma `findMany` over `PuzzleReview`:**

```ts
this.prisma.puzzleReview.findMany({
  where: { userId, dueAt: { lte: new Date() } },
  orderBy: { dueAt: 'asc' },   // oldest/most-overdue first
  take: limit,
  select: { puzzle: true },     // joins Puzzle, mapped to PuzzleDto
});
```

It reads **only the `PuzzleReview` table** (joined to `Puzzle`), ordered by the
`@@index([userId, dueAt])`. **It is the *single* source for the review queue —
there is no UNION today.**

**Extensibility for S07:** the cleanest seam is *not* to UNION a second table
into `getDue`, but to **funnel mistakes into the same `PuzzleReview` queue**.
S07's `GameMistake` rows are positions, not bank `Puzzle` rows, so two options:

- **(Preferred) Enqueue mistakes as reviews.** If S07 materialises a mistake as a
  solvable `Puzzle` (or a puzzle-shaped row keyed by a stable id), call
  `PuzzleReviewService.enqueueOnFail(userId, puzzleId)` for it. Then `getDue`
  already serves mistakes alongside failed puzzles, oldest-first, with zero
  changes here — one queue, one scheduler, one graduation rule. This is the
  intended design: review is the *destination* for any failed-tactic signal.
- **(If mistakes must stay a separate table)** add a sibling
  `getDueMistakes(userId, limit)` in the mistakes service and have the *review
  page* merge the two due lists client-side (or a new aggregator) sorted by
  `dueAt`. `getDue` itself stays single-source; the *page* becomes the union
  point. Note this would need a second scheduler-state store — `schedule()` is
  pure and reusable, but you'd persist the card state in the mistakes table.

`schedule()` (pure, in `spaced-repetition.ts`) and `GRADUATION_INTERVAL_DAYS`
are exported and reusable verbatim by S07 regardless of which path it takes — no
fork the scheduler.

## 6. Deviations + commit

**Deviations from the spec:** none material. Notes:

- **Enqueue via `@Optional()` injection** rather than a hard dependency, so the
  pre-existing `puzzle-serving.service.spec.ts` stays green untouched (it has no
  review mock). Documented in cerebrum + anatomy. Production always wires it.
- **`getDuePayload`** added (not named in the spec) as the controller's single
  call for `GET /puzzles/review/due` → `{ puzzles, dueCount, nextDueAt }`; it
  composes `getDue` + `dueCount` + (`nextDueAt` only when nothing is due) so the
  empty state can show the next-due date. The spec's `{ puzzles, dueCount }` is a
  subset of this.
- **`nextDueAt` field** added to `ReviewDueDto` (optional) to power the "next
  review {date}" empty state — additive, all new shared fields optional per S00.
- **`EASY_MS_THRESHOLD = 8000ms`** chosen for the fast-solve → `easy` mapping
  (service-local constant; documented).
- **Review UI is a thin `useLocalPuzzle` loop, not `TrainingSession`** — see §4
  for the rationale (rush precedent; review is a fixed graded queue).

**Index / query note:** both hot reads (`getDue`, `dueCount`) filter
`userId + dueAt <= now` and `getDue` orders by `dueAt asc` — exactly the
`@@index([userId, dueAt])` access path from S01. No new index needed. (Live
`EXPLAIN` at scale not re-run here — the queue is per-user and tiny relative to
the 50k `Puzzle` bank; the composite index is the correct plan.)

**Inputs for dependent sessions:**
- **S07 (mistakes):** §5 — prefer enqueuing mistakes into `PuzzleReview` via
  `enqueueOnFail`; reuse `schedule()` + `GRADUATION_INTERVAL_DAYS` from
  `spaced-repetition.ts`.
- **S13 (hub):** inject `PuzzleReviewService` (exported from `PuzzlesModule`),
  call `dueCount(user.id): Promise<number>` for the review badge; or read
  `dueCount` off `GET /puzzles/review/due`.

**Commit:** `d967964` on `epic/purechess-improve`.
