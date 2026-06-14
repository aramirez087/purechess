# Session 08 Handoff — SM-2 Scheduler Deduplication

**Branch:** `epic/dedup-cleanup--s08-sr-scheduler`
**Date:** 2026-06-13
**Status:** COMPLETE

---

## What Changed

Eliminated jscpd clone #4 (18 lines): `puzzle-review.service.ts:201-218 ↔ repertoire-review.service.ts:303-320`.

Both services had identical private `toCardState()` functions and `offsetDays()` helpers plus the `MS_PER_DAY` constant. These were extracted as exports on the existing `spaced-repetition.ts` pure module.

---

## Shared Module Extended

**`apps/api/src/puzzles/spaced-repetition.ts`** — three new exports appended after `schedule()`:

| Export | Type | Description |
|--------|------|-------------|
| `MS_PER_DAY` | `number` | Milliseconds per day constant |
| `toCardState()` | function | Maps a DB row (or null) to a schedulable `CardState` |
| `offsetDays()` | function | Returns a `Date` N days from now |

No existing exports changed. File is purely additive.

---

## Files Deduped

| File | Change |
|------|--------|
| `apps/api/src/puzzles/puzzle-review.service.ts` | Removed private `toCardState`, `offsetDays`, `MS_PER_DAY`; updated import |
| `apps/api/src/repertoire/repertoire-review.service.ts` | Removed private `toCardState`, `offsetDays`, `MS_PER_DAY`; updated import |
| `apps/api/test/puzzles/spaced-repetition.spec.ts` | Added `toCardState()` and `offsetDays()` test cases (4 new tests, 16 total) |

---

## Gate Results

### Unit tests — focused
```
PASS test/puzzles/spaced-repetition.spec.ts
Tests: 16 passed, 16 total
```

### Unit tests — full scope
```
PASS test/puzzles/puzzles.service.spec.ts
PASS test/puzzles/adaptive-selector.spec.ts
PASS test/puzzles/spaced-repetition.spec.ts
PASS test/repertoire/repertoire.service.spec.ts
PASS test/repertoire/repertoire-review.service.spec.ts
PASS test/puzzles/seed-puzzles.spec.ts
PASS test/puzzles/puzzle-serving.service.spec.ts
PASS test/puzzles/puzzle-rush.service.spec.ts
PASS test/puzzles/puzzle-review.service.spec.ts
PASS test/puzzles/puzzle-rating.service.spec.ts
PASS test/puzzles/puzzle-history.service.spec.ts
PASS test/puzzles/puzzle-catalog.service.spec.ts
PASS test/puzzles/game-mistake.service.spec.ts

Test Suites: 13 passed, 13 total
Tests:       170 passed, 170 total
```

### Typecheck
```
pnpm typecheck → EXIT 0
```

### Lint
```
pnpm --filter @purechess/api lint → EXIT 0
```

### jscpd (run from `apps/api/src/`)
```
Format      | Files analyzed | Total lines | Total tokens | Clones found | Duplicated lines | Duplicated tokens
typescript  | 140            | 13082       | 114068       | 8            | 122 (0.93%)      | 1165 (1.02%)
```

**Clone pair `puzzle-review.service.ts ↔ repertoire-review.service.ts` NOT in output.** ✓

Before: clone #4 present (18 dup lines in this pair).
After: pair absent. TypeScript clone count in api/src dropped from 9 → 8.

---

## SM-2 Math Verification

`toCardState` and `offsetDays` are copied verbatim from the private implementations. The `spaced-repetition.spec.ts` pin tests (SM-2 worked-example sequence, ease ladder, lapse reset) are unchanged and pass — identical inputs still yield identical outputs.

---

## No Behavior Change

- `schedule()` untouched
- `CardState`, `ScheduleResult`, `ReviewGrade` interfaces untouched
- All service persistence logic, DTOs, API contracts untouched
- `resolveGrade()` in `puzzle-review.service.ts` is NOT duplicated and stays private
- `enumerateLines()`, `stepOf()`, `findCard()` in repertoire service untouched

---

## Open Issues

None introduced by this session. The 4 unclaimed clusters (#10, #36-38, #42, 74 lines) from S01 remain outside this session's scope.

---

## Inputs for CI-Gate Session

- Clone #4 (`puzzle-review.service.ts:201-218 ↔ repertoire-review.service.ts:303-320`) confirmed absent post-refactor.
- New exports on `spaced-repetition.ts`: `MS_PER_DAY`, `toCardState`, `offsetDays`.
- All 170 puzzle+repertoire tests green; typecheck + lint clean.
