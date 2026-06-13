# Session 09 handoff — Opening trainer (drill your lines)

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema untouched** (S01 froze it; `RepertoireReview` used read-as-designed —
columns `userId, repertoireId, nodePath, dueAt, intervalDays, easeFactor, reps,
lapses`).

## What was built

The opening trainer: drill a repertoire from the user's side until the booked
moves are automatic, with spaced repetition over lines they miss. The board
auto-plays the opponent's booked replies; the user must produce the booked move;
"out of book" is flagged (book-move arrow) and the line is re-queued sooner.

- **Shared DTOs** — `packages/shared/src/dto/repertoire.dto.ts` (appended):
  `DrillStepDto`, `DrillLineDto`, `DrillLinesDto`, `GradeDrillDto`,
  `GradeDrillResultDto`. All new fields beyond the create set are optional per
  S00. `pnpm --filter @purechess/shared build` clean.
- **API** — `apps/api/src/repertoire/`:
  `repertoire-review.service.ts` (`getDrillLines`, `grade`, `dueLineCount`,
  `enumerateLines`), `repertoire-review.controller.ts` (GET `:id/drill`,
  POST `:id/grade`), `GradeDrillBodyDto` added to `dto/repertoire-body.dto.ts`,
  both registered **additively** in `repertoire.module.ts`.
- **Web** — `apps/web/src/`: `hooks/use-opening-drill.ts` (drill state machine),
  `components/openings/opening-drill.tsx` (board + prompt + progress + summary),
  `lib/api/repertoire.ts` extended (`fetchDrillLines`, `gradeDrill`), and a
  **Drill** button + drill view wired into `app/openings/openings-client.tsx`.
- **Tests** — `apps/api/test/repertoire/repertoire-review.service.spec.ts` (12),
  `apps/web/test/openings/opening-drill.test.tsx` (6).

## 1. Quality gates — PASS/FAIL with actual final output

| Gate | Result | Final line |
|---|---|---|
| `cd apps/api && pnpm exec tsc --noEmit` | **PASS** | exit 0 (no output) |
| `cd apps/api && pnpm test` | **PASS** | `Test Suites: 42 passed, 42 total` / `Tests: 493 passed, 493 total` |
| `cd apps/web && pnpm exec tsc --noEmit` | **PASS** | exit 0 (no output) |
| `cd apps/web && pnpm exec vitest run test/` | **PASS** | `Test Files  77 passed (77)` / `Tests  601 passed (601)` |

API tests 481 (S08) → **493** (+12 drill service cases). Web tests 595 (S08) →
**601** (+6 drill component cases). The S09 specs in isolation:
`repertoire-review.service.spec.ts` → `Tests: 12 passed`;
`opening-drill.test.tsx` → `Tests 6 passed`.

## 2. Drill outcomes shape (for S12 insights "opening leaks") + dueLineCount

### Per-line outcome (the "opening leak" signal S12 consumes)

The drill hook emits one `DrillLineResult` per finished line and a session
`DrillSummary`:

```ts
// apps/web/src/hooks/use-opening-drill.ts
interface DrillLineResult {
  nodePath: string;        // the line's serialized leaf path
  correctFirstTry: boolean;// true iff every user move was first-try correct
  misses: number;          // count of off-book (wrong) user moves in the line
}
interface DrillSummary {
  results: DrillLineResult[];
  linesTrained: number;
  firstTryRate: number;    // share of lines done clean, 0..1
}
```

**Server side, the grade is persisted via** `RepertoireReview` and the response
carries the reschedule:

```ts
// POST /repertoire/:id/grade  (body: GradeDrillDto { nodePath, correctFirstTry })
interface GradeDrillResultDto {
  nodePath: string;
  nextDueAt: string;   // ISO
  intervalDays: number;
}
```

**For S12 "opening leaks":** the leak signal is a line the user repeatedly
misses — i.e. a `RepertoireReview` row with a high `lapses` count and/or a short
`intervalDays` that never grows. S12 can read these per repertoire
(`prisma.repertoireReview.findMany({ where: { userId, repertoireId } })`,
ordered by `lapses desc`) — `nodePath` resolves back to the missed line via the
tree (walk `children[idx]` for each `idx` in `nodePath.split('.')`).

### `dueLineCount` (S13 hub badge)

```ts
// apps/api/src/repertoire/repertoire-review.service.ts
dueLineCount(userId: string, repertoireId: string): Promise<number>
```

Counts `RepertoireReview` rows where `dueAt <= now` for `(userId, repertoireId)`,
via the `@@index([userId, dueAt])`. `RepertoireReviewService` is **exported from
`RepertoireModule`**, so S13 injects it directly and calls
`dueLineCount(user.id, rep.id)` — no new endpoint required. (The
`GET /repertoire/:id/drill` payload also carries `dueLineCount` if a fetch is
more convenient — it is the FULL due count, which may exceed the capped
`lines.length`.)

## 3. How a line is enumerated + nodePath ↔ RepertoireReview mapping

**A "line" = a root→LEAF path through the tree.** `enumerateLines(root)`
(exported pure helper in `repertoire-review.service.ts`) does an **iterative**
DFS (stack, no recursion — a deep megabase chain can't overflow), collecting one
entry per node with `children.length === 0`:

```ts
{ nodePath: path.join('.'), steps: DrillStepDto[] }  // steps = every ply root→leaf
```

**GOTCHA (bug-538):** an *interior* node is NOT a line. In `1.e4 e5 2.Nf3 Nc6`,
the `e5` node (path `0.0`) continues into `Nf3`, so it is **not** a drillable
leaf; the only leaf there is `0.0.0.0` (`Nc6`). A bare root (no moves) yields
zero lines.

**`nodePath` encoding** (S09's choice for the frozen `String` column):
`path.join('.')` — each element is the `children[]` index at that depth,
`''` would be the root (never a line). So `"0.0.0.0"` = `children[0]` four deep.
**To resolve a stored `nodePath` back to a position:** split on `.`, walk
`root.children[idx]` for each index; the final node's `fen` is the leaf position
and its `steps` are the moves to drill. A stale due card whose `nodePath` no
longer resolves in the current tree is **silently ignored** by `getDrillLines`
(it filters due cards to paths that still exist), so editing a repertoire never
strands the drill.

**Grading mapping:** `grade(userId, repertoireId, nodePath, correctFirstTry)`
finds-or-creates the `RepertoireReview` row keyed by
`(userId, repertoireId, nodePath)` (via `findFirst` then `update`/`create`),
maps `correctFirstTry → 'good'` / a miss → `'again'`, runs the shared
`schedule()`, and writes `dueAt/intervalDays/easeFactor/reps/lapses`.

## 4. S06 scheduler reuse — confirmed verbatim

`RepertoireReviewService` imports the pure scheduler unchanged:

```ts
import { DEFAULT_EASE, schedule, type CardState, type ReviewGrade }
  from '../puzzles/spaced-repetition';
import { GRADUATION_INTERVAL_DAYS } from '../puzzles/puzzle-review.service';
```

`spaced-repetition.ts` was **not modified**. The grade ladder is identical to
the puzzle queue (rep 1 → 1d, rep 2 → 6d, rep ≥3 → `round(prev × ease)`; `again`
→ reps 0, lapses +1, interval 1d, ease −0.2 floored 1.3). Verified by the spec:
a fresh `good` → interval 1 / reps 1; a rep-2 card at 6d/2.5 graded `good` →
interval 15 / reps 3; an `again` on a 15d/rep-3 card → interval 1 / reps 0 /
lapses 1 / ease 2.3.

## 5. Deviations / notes

- **A drilled line is NEVER deleted on graduation** (unlike the puzzle queue,
  which deletes a card whose interval crosses `GRADUATION_INTERVAL_DAYS`). A
  repertoire line you can play perfectly is still worth an occasional refresh,
  so the card stays scheduled at the grown interval; crossing the threshold only
  logs. This is the one intentional behavioral divergence from S06's queue.
- **`getDrillLines` reserves new-line slots.** `DRILL_SESSION_LIMIT = 8` with
  `NEW_LINES_PER_SESSION = 3`: when both due and new lines exist, at least 3
  slots go to fresh material so a long due backlog never fully crowds out new
  lines. Due leads; most-overdue first (matches the puzzle queue's oldest-first).
- **`GradeDrillResultDto` returns `nextDueAt` (non-null)** — a drilled line is
  always rescheduled (never graduated-and-gone), so unlike `ReviewGradeResultDto`
  there is no null/`graduated` case.
- **The off-book correction reuses the EXISTING annotation/arrow support.** The
  book-move arrow is `bestMoveArrow(uci, 'green')` fed to the Chessboard
  `autoShapes` prop — the same path analyze uses, no fork. On a miss the line
  still advances along the **booked** move (not the user's wrong move) so the
  drill keeps its shape, and the miss counts against `correctFirstTry`.
- **Drill state machine is synchronous (no timers)** — opponent replies
  auto-play in a tight loop, so unlike `useLocalPuzzle` there are no auto-reply /
  reveal `setTimeout`s. The web test uses `fireEvent` + `waitFor` (real chess.js,
  no fake timers).
- **No new DB hot query / EXPLAIN needed.** `getDrillLines` does one
  `repertoireReview.findMany({ where: { userId, repertoireId } })` (small
  per-(user,repertoire) cardinality, served by `@@index([userId, dueAt])`);
  `dueLineCount` is one `count` over the same index. No seq-scan risk at scale.
- **No WS needed** (consistent with the operator rules).
- **bug-538 (fixed):** the first API spec fixture treated an interior node as a
  drillable line — corrected to leaf-only enumeration. See §3.

## Inputs for dependent sessions

- **S12 (insights / "opening leaks"):** read `RepertoireReview` rows per
  repertoire (`{ userId, repertoireId }`), rank by `lapses desc` /
  short-non-growing `intervalDays` for the most-missed lines; resolve `nodePath`
  → line by walking `children[idx]` over the `RepertoireDto.tree`. The drill
  outcome shape (`DrillLineResult`, `GradeDrillResultDto`) is in §2.
- **S13 (hub):** inject `RepertoireReviewService` (exported from
  `RepertoireModule`), call `dueLineCount(user.id, repertoireId): Promise<number>`
  for the per-repertoire drill badge; or read `dueLineCount` off
  `GET /repertoire/:id/drill`.
- **REST surface added** (both `@UseGuards(SessionAuthGuard)`, ownership-scoped
  404):

  | Method | Path | Body | Returns |
  |---|---|---|---|
  | `GET` | `/repertoire/:id/drill` | — | `DrillLinesDto` |
  | `POST` | `/repertoire/:id/grade` | `GradeDrillDto` | `GradeDrillResultDto` |

  Web client (`apps/web/src/lib/api/repertoire.ts`, `credentials:'include'`):
  `fetchDrillLines(id)`, `gradeDrill(id, { nodePath, correctFirstTry })`.

**Commit:** see the S09 commit on `epic/purechess-improve` (message
`feat(improve): S09 opening trainer`).
