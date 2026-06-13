# Session 07 handoff — Mistakes from your own games → puzzles

**Status:** complete, all quality gates green.
**Branch:** `epic/purechess-improve`.
**Schema:** untouched (frozen after S01). No `schema.prisma` edits — the
`GameMistake` table from S01 was used read-as-designed.

## What was built

1. **`GameMistakeService`** (`apps/api/src/puzzles/game-mistake.service.ts`) —
   the server-authoritative gate over `GameMistake`: `saveMistakes`,
   `listMistakes`, `getDueMistakes`, `markReviewed`. Exports
   `MISTAKE_CP_THRESHOLD = 150`.
2. **`GameMistakeController`** (`game-mistake.controller.ts`) + **`SaveMistakesDto`**
   (`dto/save-mistakes.dto.ts`) — `POST /games/:gameId/mistakes`,
   `GET /me/mistakes?unreviewedOnly=`, `POST /me/mistakes/:id/review`.
   Registered additively in `puzzles.module.ts` (controllers + providers +
   exports).
3. **Shared DTOs** — `MistakeCandidateDto`, `SaveMistakesRequestDto`,
   `SaveMistakesResultDto`, `GameMistakeDto` in `puzzle.dto.ts` (shared rebuilt).
4. **Web API client** — `saveGameMistakes`, `fetchMistakes`,
   `markMistakeReviewed` in `apps/web/src/lib/api/puzzles.ts`.
5. **`use-mistake-capture.ts`** (`apps/web/src/hooks/`) — fire-and-forget,
   idempotent capture of the viewer's own blunders after classification.
   Exports `collectOwnMistakes` + `CAPTURE_CP_THRESHOLD`.
6. **`MistakeTrainer`** (`apps/web/src/components/review/mistake-trainer.tsx`) —
   in-review "solve your own mistake" panel, wired additively into
   `review-client.tsx` (new optional `viewerColor` prop threaded from `page.tsx`).
7. **Tests** — `game-mistake.service.spec.ts` (18 cases, mocked Prisma),
   `mistake-trainer.test.tsx` (6 cases, mocked board/api/sound).
8. **OpenWolf** — cerebrum (Decision Log + Key Learnings S07), anatomy (new +
   edited files), memory.

## 1. Quality gates — all PASS

| Gate | Command | Final output line |
|---|---|---|
| API tsc | `cd apps/api && pnpm exec tsc --noEmit` | exit 0 (clean) |
| API tests | `cd apps/api && pnpm test` | `Test Suites: 40 passed, 40 total` / `Tests: 459 passed, 459 total` |
| Shared build | `cd packages/shared && pnpm build` | exit 0 (clean) |
| Web tsc | `cd apps/web && pnpm exec tsc --noEmit` | exit 0 (clean) |
| Web tests | `cd apps/web && pnpm exec vitest run test/` | `Test Files  75 passed (75)` / `Tests  590 passed (590)` |

API went 441 (S06) → **459** (+18 new mistake-service cases). Web went
584 (S06) → **590** (+6 new mistake-trainer cases). All S04/S05/S06 suites stay
green (the S06 review-page test renders `ReviewClient` with no `viewerColor`/no
classification, so the additive capture hook + trainer are inert there).

## 2. The mistake-review backlog model + the FK constraint

### FK constraint confirmed (the reason for the backlog model)

`schema.prisma` (READ ONLY, confirmed):

- **`PuzzleReview.puzzleId` IS a foreign key to `Puzzle`** (`puzzle Puzzle @relation(fields: [puzzleId], references: [id], onDelete: Cascade)`, schema.prisma:388). A synthetic `mistake:<id>` row would violate this FK.
- **`GameMistake` has NO spaced-repetition columns** — only `reviewed Boolean @default(false)` + `createdAt`, with `@@unique([gameId, ply, userId])` and `@@index([userId, createdAt])`. No `dueAt`/`intervalDays`/`easeFactor`.

So a mistake **cannot** be inserted into `PuzzleReview` (FK violation) and
**cannot** carry a true SM-2 schedule under the frozen schema.

### Backlog model

"Mistake review" is modelled as the **set of `GameMistake` rows with
`reviewed = false`, ordered by `createdAt`** — the unreviewed backlog. Solving a
mistake inline flips `reviewed = true` (`markReviewed`).

### How it unions with `PuzzleReview` (the S06/S13 contract)

We did **NOT** touch S06's `getDue` — it stays the single source over
`PuzzleReview`. Instead the union is exposed as a **sibling source**:

```ts
// apps/api/src/puzzles/game-mistake.service.ts
getDueMistakes(userId: string, limit = 20): Promise<GameMistakeDto[]>
//   where { userId, reviewed: false }  orderBy { createdAt: 'asc' }  take limit
```

`GameMistakeService` is **exported from `PuzzlesModule`**, so the review surface
(or S13 hub) can inject it and **merge `getDueMistakes()` with
`PuzzleReviewService.getDue()` at the PAGE level** (both already oldest-first).
This matches S06 handoff §5 option (b): `getDue` stays single-source; the *page*
becomes the union point. The two item shapes differ (`PuzzleDto` vs
`GameMistakeDto`), and a mistake is graded by `markReviewed` (a backlog flip),
not by the SM-2 `gradeReview` endpoint — so they are merged as two lists, not one
typed queue.

**If full SM-2 on mistakes is ever wanted** (a mistake that comes back at growing
intervals rather than a one-shot backlog flip), it needs an **S01 schema
amendment**: add `dueAt`/`intervalDays`/`easeFactor`/`reps`/`lapses` columns to
`GameMistake`, then reuse the pure `schedule()` + `GRADUATION_INTERVAL_DAYS` from
`spaced-repetition.ts` verbatim. Out of scope for the frozen schema.

## 3. cpLoss threshold + the FEN re-derivation (anti-spoof)

**Threshold: `cpLoss >= 150`** (`MISTAKE_CP_THRESHOLD`, exported from the
service; mirrored client-side as `CAPTURE_CP_THRESHOLD` in
`use-mistake-capture.ts`). Matches the classifier's mistake/blunder bands. The
client filters on `class ∈ {mistake, blunder}` **and** capped `cpl >= 150`; the
server re-checks `cpLoss >= 150` regardless of what the client sends.

**Server-side FEN re-derivation (the anti-spoof core), in `saveMistakes`:**

1. Load the game with its `whiteUserId`/`blackUserId`/`startingFen` and its
   `Move` rows (`ply`, `uci`, `fenAfterMove`). Game must exist (`NotFound` else)
   and the user must be one of the two players (`Forbidden` else).
2. For each candidate at `ply` P:
   - **Own-side check:** the mover is fixed by ply parity (`P % 2 === 1` ⇒
     White). Skip unless that side is the requesting user's side.
   - **Re-derive the position BEFORE P** from the persisted record — **not** from
     a chess.js replay of the client's claim: it is `Move[P-1].fenAfterMove`
     (or `game.startingFen` / standard start when P === 1). Skip if the ply isn't
     in the record (bogus claim) or there's a gap.
   - **Compare** the client's claimed `fen` (placement/turn/castling/ep only —
     halfmove/fullmove clocks ignored via `split(' ').slice(0,4)`) against the
     re-derived FEN, and the claimed `playedUci` against `Move[P].uci`. **Skip on
     any mismatch.**
   - **Threshold:** skip if `cpLoss < 150`.
3. Upsert the survivors (`@@unique([gameId, ply, userId])`, idempotent) **storing
   the server-derived FEN and the recorded `playedUci`**, never the client's
   claim. One bad candidate is skipped silently — it never throws, so legitimate
   rows in the same batch still persist. Returns the saved count.

This is proven by the spec: a spoofed `fen` (start FEN claimed for ply 3) and a
spoofed `playedUci` (`d2d4` when `g1f3` was recorded) are both rejected; an
opponent-side move is skipped; the stored `fen` equals the server-derived one
even when the client sends bogus clocks.

## 4. `GameMistakeDto` shape (S12 insights consumes `themeGuess`)

```ts
// packages/shared/src/dto/puzzle.dto.ts
export interface GameMistakeDto {
  id: string;
  gameId: string;
  ply: number;            // 1-based
  fen: string;            // position BEFORE the blunder — the puzzle start
  playedUci: string;      // what the user actually played
  bestUci: string;        // engine best move in that position
  bestLineUci: string[];  // engine best line — the solution to re-solve
  cpLoss: number;         // centipawns lost (≥ 0)
  themeGuess?: string[];  // tactical-theme guesses — S12 weakness clusters
  reviewed: boolean;      // true once re-solved
  createdAt: string;      // ISO
}
```

**For S12:** cluster `themeGuess[]` across a user's `listMistakes(userId)`
(newest-first) to surface their recurring weakness (e.g. "you hang pieces to
forks"). The client classifier does **not** populate `themeGuess` yet (it has no
theme tagger), so today the array is typically empty — the column + DTO field are
plumbed end-to-end and ready. If S12 wants real theme tags, the cheapest source
is to run a tactical-motif heuristic on the position when capturing (web) or in a
server backfill; either way it flows through the existing optional field with no
schema change.

**The request shape** the client POSTs (`MistakeCandidateDto`) is the same minus
`id`/`reviewed`/`createdAt`, plus the server ignores/overwrites `fen` and
`playedUci` with its re-derived values.

## 5. Did we wire mistakes into `/puzzles/review`? (for S13)

**No — we exposed the service and documented the union seam; we did NOT modify
the S06 `/puzzles/review` page.** Rationale (per the operator rule "reuse, don't
disturb"):

- The S06 review-client is a tight SM-2 loop: one `PuzzleDto` queue graded by
  `gradeReview(id, {solved, msToSolve})` with a graduation outcome. A mistake is
  a different shape (`GameMistakeDto`), a different solve target (its best line),
  and a different "completion" (a `reviewed` backlog flip, no SM-2 reschedule).
  Bending the review-client to host both would have meant conditional item types
  + a branch on the grade call — real regression risk on a green S06 surface.
- The mistakes **ARE** surfaced where they're most motivating: **inline on the
  game review page** via `MistakeTrainer` ("you played Qd2?? — find what you
  missed"), solved right there from the correct position.

**For S13** (the review hub / union page): inject `GameMistakeService` (exported
from `PuzzlesModule`) and call `getDueMistakes(user.id)`, then render its result
**alongside** `PuzzleReviewService.getDue(user.id)` — two sections ("Spaced
review" + "From your games") or one merged list sorted by recency. The
`GET /me/mistakes?unreviewedOnly=true` endpoint is the HTTP equivalent for a
client-fetched union. A "From your games" badge count = `getDueMistakes(...).length`
(or add a `count` query if a cheaper read is wanted — the per-user backlog is
tiny).

## 6. Endpoints, capture flow, and the trainer (exact next-session inputs)

**Endpoints** (global `api` prefix ⇒ `/api/...`, all `SessionAuthGuard` +
`@CurrentUser`):

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/games/:gameId/mistakes` | `{ mistakes: MistakeCandidateDto[] }` | `{ saved: number }` |
| GET | `/me/mistakes?unreviewedOnly=` | — | `GameMistakeDto[]` (newest-first) |
| POST | `/me/mistakes/:id/review` | — | `{ next: GameMistakeDto \| null }` |

**Capture flow** (`use-mistake-capture.ts`): `review-client.tsx` calls
`useMistakeCapture({ gameId, moves, startFen, viewerColor, classification })`.
When the user runs "Analyze game" and the classifier finishes, the hook collects
the viewer's own `mistake`/`blunder` moves over threshold and POSTs them once
(`saveGameMistakes`, fire-and-forget, `.catch` re-arms a retry). No-op when
`viewerColor` is null (spectator/pasted analysis) or classification is absent.
`viewerColor` is derived in `page.tsx` from `currentUser` vs `review.white.id` /
`review.black.id`.

**Trainer** (`mistake-trainer.tsx`): renders local `MistakeItem[]` derived in
`review-client.tsx` from the same classification (immediate, no round-trip). On
solve it resolves the persisted id by ply from `fetchMistakes(gameId)` and calls
`markMistakeReviewed(id)` (best-effort — if capture hasn't landed the id yet, the
solve still works visually and the mark is skipped).

## 7. Index / query note

- **`saveMistakes`** reads one game by PK + its `Move` rows (`@@unique([gameId, ply])`),
  then upserts on `@@unique([gameId, ply, userId])` — all index-backed.
- **`listMistakes` / `getDueMistakes`** filter `userId` and order by `createdAt`,
  matching `@@index([userId, createdAt])` from S01. The `reviewed = false`
  predicate isn't in the index, but the per-user backlog is tiny relative to the
  50k `Puzzle` bank — no seq-scan concern, no new index needed. (Live `EXPLAIN`
  at scale not re-run; the access path is the composite index by design.)

## 8. Deviations + commit

**Deviations from the spec:** none material. Notes:

- **`enqueueAsReview` was NOT implemented as a PuzzleReview write** (the spec's
  option (b) "materialize a synthetic `mistake:<id>`") — it would violate the
  `PuzzleReview.puzzleId → Puzzle` FK. Replaced by the **backlog model +
  `getDueMistakes` union seam** mandated by the session constraint. `markReviewed`
  is the backlog equivalent of "graded".
- **`markReviewed` returns the next unreviewed mistake** (not named in the spec's
  return) so the client can chain a solve session; `null` when the backlog is
  empty.
- **`viewerColor` prop added to `ReviewClient`** (optional, defaults `null`) —
  additive; threaded from `page.tsx`. Existing callers (e.g. `/analyze`) pass
  nothing and are unaffected.
- **The solution line is one move (`[bestUci]`)** — the existing client
  classifier exposes only the single best MOVE per ply, not the full PV. A
  one-move "find the move you missed" puzzle is the correct UX. If a deeper line
  is ever wanted, the classifier must surface the PV (out of scope here).
- **Forbidden pre-existing uncommitted files left untouched** (chessboard.tsx,
  globals.css, settings-form.tsx, piece*.tsx, themes.ts, hero-board*,
  coordinates.tsx, loading.tsx) — verified none are in this session's diff.

**Inputs for dependent sessions:**
- **S12 (insights):** consume `GameMistakeDto.themeGuess[]` clusters via
  `GameMistakeService.listMistakes(userId)` (injectable from `PuzzlesModule`) or
  `GET /me/mistakes`. Field is plumbed; populate it if real theme tags are wanted.
- **S13 (hub/union):** inject `GameMistakeService`, call
  `getDueMistakes(user.id, limit)` and render alongside
  `PuzzleReviewService.getDue(user.id)`; backlog badge =
  `getDueMistakes(...).length` (or `GET /me/mistakes?unreviewedOnly=true`).
- **S01 amendment (only if full SM-2 on mistakes is desired):** add SR columns to
  `GameMistake` and reuse `schedule()` + `GRADUATION_INTERVAL_DAYS` from
  `spaced-repetition.ts`.

**Commit:** `13ac80e` on `epic/purechess-improve`.
