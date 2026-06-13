# Session 05 handoff — Puzzle Rush (timed board vision)

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits. PB lives in Redis.

## What was built

1. **`PuzzleRushService`** (`apps/api/src/puzzles/puzzle-rush.service.ts`) —
   `buildSet(userId, mode)` assembles ~40 escalating-rating puzzles and caches
   the set in Redis under a run id; `recordRun(userId, {mode,score,durationMs})`
   stores the per-mode personal best in a Redis hash and returns `{best, isPB}`;
   `getPersonalBests(userId)` returns `{'3min', '5strikes'}`. **No `PuzzleRun`
   table** — see the PB-storage decision below.
2. **`PuzzleRushController`** (`apps/api/src/puzzles/puzzle-rush.controller.ts`,
   `@Controller('puzzles/rush')`) + class-validator body DTOs
   (`apps/api/src/puzzles/dto/rush.dto.ts`). Registered **additively** in
   `puzzles.module.ts` (the known Wave-3 seam: one line each in `controllers`,
   `providers`, `exports`).
3. **`RushHud`** (`apps/web/src/components/puzzle/rush-hud.tsx`) — big countdown
   (3min) or strikes-remaining (5strikes), brass score, combo flame, red pulse
   under 15s reusing the existing `clock-pulse` keyframes (no new keyframes).
4. **`/puzzles/rush`** server page (`page.tsx`) + `rush-client.tsx` — pre-run
   mode toggle + Start + PB per mode; run feeds the set into `useLocalPuzzle`
   one at a time (instant advance, no 1.2s delay); post-run score + PB / new-
   record celebration + Again / Back to Train.
5. **Web client fns** (`apps/web/src/lib/api/puzzles.ts`) — `startRush`,
   `finishRush`, `fetchRushPersonalBests`.
6. **Shared DTOs** (`packages/shared/src/dto/rush.dto.ts`, re-exported from
   `index.ts`) — `RushMode`, `Rush{Start,Finish}{Request,Response}Dto`,
   `RushPersonalBestsDto`. All fields additive/optional where appropriate.
7. **Tests** — `puzzle-rush.service.spec.ts` (12 cases), `rush-client.test.tsx`
   (6 cases). OpenWolf: cerebrum, anatomy, memory, buglog (`bug-522`).

## 1. Quality gates — all PASS

| Gate | Command | Final output line |
|---|---|---|
| API tsc | `cd apps/api && pnpm exec tsc --noEmit` | exit 0 (clean) |
| API tests | `cd apps/api && pnpm test` | `Test Suites: 37 passed, 37 total` / `Tests: 417 passed, 417 total` |
| Web tsc | `cd apps/web && pnpm exec tsc --noEmit` | exit 0 (clean) |
| Web tests | `cd apps/web && pnpm exec vitest run test/` | `Test Files  74 passed (74)` / `Tests  584 passed (584)` |

API tests went 405 → **417** (the 12 new rush-service cases). Web tests went
578 → **584** (the 6 new rush-client cases). All new files pass `prettier --check`.

## 2. PB-storage decision (Redis key shape) + future-table flag

**Decision: the personal best is stored server-side in Redis, NOT a Prisma
table.** The schema is frozen after S01 and there is no `PuzzleRun` table.

- **Key:** `puzzle:rush:pb:<userId>` — a Redis **HASH**, one field per mode:
  `{ '3min': '<best>', '5strikes': '<best>' }`. `recordRun` does `HGET` the
  mode field, compares (`score > prev`), and only `HSET`s on a strict
  improvement; `getPersonalBests` does `HGETALL` (0 for unset modes).
- **The assembled set** is also cached: `puzzle:rush:set:<runId>` (a JSON blob
  `{userId, mode, puzzles}`, `EX 30min`) keyed by a `randomUUID` run id.

**Why Redis is the right call here, not a stopgap:** rush is a fast-rep drill,
not a permanent ledger. The durable, auditable signal already exists — **every
solved/failed rush puzzle records a normal `PuzzleAttempt(source: 'rush')`**
(server-authoritative), which feeds the puzzle Glicko + theme stats. The PB is
just a leaderboard-of-one for motivation.

**Future-table flag (for an S01 amendment if ever wanted):** if the product
later needs durable per-run history (a global rush leaderboard, run-by-run
charts, "your last 20 runs"), add a `PuzzleRun` table:

```prisma
model PuzzleRun {
  id         String   @id @default(cuid())
  userId     String
  mode       String   // '3min' | '5strikes'
  score      Int
  durationMs Int
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, mode, score])
}
```

`recordRun` would then `INSERT` a row and derive `best` from
`MAX(score) WHERE userId, mode` (the Redis hash can stay as a hot cache or be
dropped). This is an **S01 amendment**, not done here per the freeze rule.

## 3. Rush endpoints + how solutions are protected

All under `@Controller('puzzles/rush')` → `/api/puzzles/rush/*`. Auth =
`SessionAuthGuard` (cookie `purechess_session`) + `@CurrentUser() user: User`.

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/puzzles/rush/start` | `{ mode?: '3min'\|'5strikes' }` (default `3min`) | `{ runId, puzzles: PuzzleDto[], mode }` (HTTP 200) |
| POST | `/puzzles/rush/finish` | `{ mode?, score, durationMs? }` | `{ best, isPB, mode }` (HTTP 200) |
| GET | `/puzzles/rush/pb` | — | `{ '3min': number, '5strikes': number }` |

**Solution protection — honest honor-system note.** The whole set, **including
the solution lines** (`PuzzleDto.moves`), is sent to the client at `start`. This
is the **simpler, honest option**, chosen deliberately over move-by-move
serving (the spec offered the choice). Rationale:

- It is **identical to the existing daily/theme-trainer solve loop**, which also
  ships `PuzzleDto.moves` to the client. Rush introduces no new exposure.
- Rush scores feed **only a Redis personal best** (a single-user motivator), not
  a competitive ladder. There is no incentive structure worth defending with
  server round-trips per move (which would also defeat the speed goal).
- The **server-authoritative signal is the per-attempt `PuzzleAttempt`**, which
  the client cannot forge a rating from — the rating math runs server-side.

If a competitive global leaderboard is ever added (alongside the `PuzzleRun`
table above), revisit this: serve solutions move-by-move from the
`puzzle:rush:set:<runId>` cache and validate each submitted move server-side
before crediting the score. Not needed for the current product.

## 4. How rush attempts flow into stats / rating

Each solved or failed puzzle in a run fires
`recordAttempt(puzzle.id, { solved, msToSolve?, source: 'rush' })`
**fire-and-forget** (`.catch(() => {})`) from `rush-client.tsx` — the network
never blocks the next puzzle. That POST hits the **existing** S03 path
(`PuzzleServingService.recordAttempt` via `PuzzleTrainingController`): it inserts
a `PuzzleAttempt` (tagged `source: 'rush'`), updates the user's **puzzle Glicko**
(`PuzzleRatingService.applyResult`, the reused paper-exact engine), bumps
`Puzzle.plays`, and returns the rating delta. So:

- **Puzzle rating:** every rush solve/miss is one Glicko game → the rating moves
  exactly as a theme-trainer attempt would. Rush is a first-class rating input.
- **Theme stats:** `getStats` rolls up by `PuzzleAttempt.puzzle.themes`, so rush
  attempts count toward each theme's accuracy (weakest-first surfacing). The
  `source` column lets a future view filter rush-only if wanted.
- **The rush `score`** is the in-run correct-solve count; the **PB** is its
  server-owned max per mode (Redis). These are separate from the rating — rush
  is both a rating drill AND a self-competitive game.

## 5. Set assembly (for S06/S07 reuse) + decisions

`buildSet`: base = user puzzle rating (via `PuzzleRatingService.get`, default
1500). Ramp `base-200 → base+400` over `SET_SIZE = 40` rungs. Each rung calls
`pickNear(target, excludeSet)`:

```sql
SELECT ... FROM "Puzzle" p
WHERE p.rating BETWEEN $target-90 AND $target+90
  AND p.id NOT IN ($...picked)        -- intra-set de-dup
ORDER BY abs(p.rating - $target) ASC, random()
LIMIT 1
```

built from composable `Prisma.sql` (fully parameterized, same idiom as
`PuzzleServingService.pickOne`). A `pickFill` (nearest-to-base, excludes picked)
backfills if narrow bands + de-dup leave the set short on a sparse bank.
**The final set is sorted by rating ASC before returning** — fill rows can land
out of order, and a clean ramp (gimmes → hard finish) is the whole point.

**`EXPLAIN` note:** like the S03 selection query, at small bank sizes the planner
seq-scans `Puzzle` (table too small for the rating B-tree to win). Per the S01
DoD, re-run `EXPLAIN` on `pickNear` after the 50k production seed to confirm the
`Puzzle_rating_idx` B-tree is used and p95 < 80 ms. Each `buildSet` issues up to
40 `pickNear` queries + 1 optional `pickFill`; if that round-trip count matters
at scale, a single windowed query (`ORDER BY rating, sample per band`) is the
optimization — deferred, not needed at current scale.

## 6. Deviations + commit

**Deviations from the spec:** none material. Notes:

- **PB → Redis hash (not sorted-set).** The spec said "Redis sorted-set / key
  per user+mode". A per-user **hash** (field-per-mode) is the cleaner shape for
  "one PB per mode" — a single key per user, O(1) `HGET`/`HSET`/`HGETALL`, no
  member churn. A sorted-set buys nothing here (we don't rank members). The set
  *cache* uses a plain `SET ... EX`.
- **Final set is sorted by rating ASC** (added to the service) so the ramp is
  clean regardless of which rung or the backfill sourced each row — the spec's
  "escalating rating" intent, made robust against sparse-bank fill.
- **Honor-system solution serving** (the explicitly-offered simpler option) —
  documented in §3 with the upgrade path.
- A `GET /puzzles/rush/pb` endpoint + `fetchRushPersonalBests` client fn were
  added (not strictly in the task list) so the server page can render the PB
  server-side without the client guessing — small, in-scope.
- New shared DTOs in `packages/shared/src/dto/rush.dto.ts`; rebuild shared after
  editing (`pnpm --filter @purechess/shared build`).

**Inputs for dependent sessions:**

- **S06 (review) / S07 (mistakes):** the same `useLocalPuzzle` one-at-a-time
  feeding pattern works for any pre-fetched list — see `RushRun` in
  `rush-client.tsx` (feed `puzzles[index]`, advance on `onSolved`/`onFailed`).
  Reuse `RushHud` only if you need a timer/strikes HUD; otherwise these modes
  more likely reuse `TrainingSession` (per the S04 handoff) with a `fetchPuzzle`
  prop.
- **S11 (training hub):** the rush PB is at `GET /puzzles/rush/pb`; deep-link
  into a run at `/puzzles/rush`. `TrainingPlanItemDto.kind: 'rush'` already
  exists in shared.

**Commit:** `<hash>` on `epic/purechess-improve` (see report).
