# ADR-6: Local puzzle bank + per-user puzzle Glicko

**Status:** Accepted (purechess-improve epic, 2026-06)

> ADRs 1–5 live as sections in `docs/ARCHITECTURE.md`. The Improve epic's ADRs
> live here in `docs/adr/` and continue that numbering.

## Decision

1. **Seed a local copy of the lichess CC0 puzzle dump into our own Postgres**
   (top-N by popularity, `Puzzle` table) and serve every training puzzle from it.
   The runtime **never** calls the lichess puzzle API for theme/rush/review
   serving. (The one exception is the *daily* puzzle, which is a deliberately
   thin lichess proxy cached 24h in Redis — it is not part of the rated training
   loop.)
2. **Rate puzzles and users with the SAME Glicko-2 implementation the game
   ratings use.** A puzzle attempt is modelled as one Glicko "game": the user is
   the player, the puzzle is the opponent (`rating = Puzzle.rating`,
   `ratingDeviation = Puzzle.ratingDeviation`), `score = solved ? 1 : 0`.

## Context

The Improve surface needs to (a) pick a rating-appropriate, theme-filtered,
unseen puzzle on every request at low latency and high volume, and (b) track how
strong each user is at tactics so the difficulty self-calibrates.

### Why a local bank over live lichess calls

- **Latency + availability.** A `GET /puzzles/next` that filtered by rating band
  + theme + "unseen by this user" cannot be expressed against the lichess API at
  all, and even the daily endpoint is a network round-trip. Against our own
  Postgres the hot selection runs on a B-tree (`Puzzle_rating_idx`) and a GIN
  index (`Puzzle_themes_idx`); measured p95 < 3 ms at 50k puzzles + a
  400-attempt user (target was < 80 ms). No external dependency sits in the
  request path.
- **The selection logic is ours.** Rating windows, the unseen-exclusion
  anti-join, `ORDER BY random()`, the adaptive ladder, weakest-theme interleave —
  all are SQL/app concerns that require the rows to be local and indexed.
- **CC0 license.** The lichess puzzle dump is public domain (CC0 1.0), so
  redistributing a local copy is unambiguously fine. We link lichess in the UI as
  a courtesy, not an obligation.
- **Cost + rate limits.** Per-request external calls would be throttled and slow;
  a local bank is a one-time seed (see `docs/runbooks/puzzle-db-refresh.md`).

The cost is an operator-run seed + a refresh cadence (quarterly), which the
runbook captures. The dump is never committed (`*.puzzle.csv` is git-ignored).

### Why reuse the game Glicko (no second rating system)

- `updateRating(player, games)` in `apps/api/src/ratings/glicko2.ts` was already
  a **pure, exported, paper-exact** function. `PuzzleRatingService.applyResult`
  imports it verbatim and treats one puzzle as one opponent. There is exactly one
  Glicko implementation in the codebase, pinned by the same worked-example test
  vector in both the game-ratings spec and the puzzle-ratings spec — so a change
  to Glicko can't silently diverge the two surfaces.
- A puzzle rating in the **same units** as the puzzle's own difficulty rating
  makes the serving ladder trivial: "give me a puzzle near my rating" is a rating
  band query, and the win/loss expectation is calibrated by construction.
- **`PuzzleRating` columns are `Float`, not `Int`** (unlike the game `Rating`):
  the puzzle rating updates **every attempt** (a continuous "rating period"), so
  storing the unrounded Glicko triple (rating/deviation/volatility) prevents
  deviation/volatility drift under repeated single-game updates. A zero-RD puzzle
  opponent is clamped to a floor (60) so a sparse-seed `ratingDeviation = 0`
  can't collapse the variance term to NaN.

## Schema-frozen approach

The whole epic froze `schema.prisma` after Session 01: every table/column the
Improve surface needs (`Puzzle`, `PuzzleAttempt`, `PuzzleRating`, `PuzzleReview`,
`Repertoire`, `RepertoireReview`, `EndgameDrill`, `EndgameAttempt`,
`TrainingStreak`, `TrainingDay`, `GameMistake`) landed in one migration. This let
four Wave-3 sessions run in parallel without fighting `schema.prisma`. Two
consequences follow from the freeze:

- **Rush personal-bests live in Redis, not a table** (a `puzzle:rush:pb:<userId>`
  hash), because adding a `PuzzleRun` table would have required a schema change.
  Every rush solve still records a normal `PuzzleAttempt(source:'rush')`, so the
  durable Glicko + theme stats are unaffected; only the leaderboard-style run
  history is deferred (see the closeout backlog).
- **Index-only migrations are still allowed** (an index is not a behavioral
  schema change). Session 16's perf work measured the hot queries at 50k and
  found the S01 indexes (`Puzzle_rating_idx`, `Puzzle_themes_idx`) sufficient —
  **no new index was needed.**

## Consequences

- One Glicko code path; provable parity between game and puzzle ratings.
- Selection latency is an index-plan problem we own and can measure, not an
  external-API problem we can't.
- A periodic operator seed is required; the bank is otherwise immutable and
  cache-friendly. The daily-puzzle, theme-histogram, and tablebase caches in
  Redis carry the only external/derived reads.
- Personal-best run history and any future durable rush ledger require a
  (post-freeze) schema amendment — captured in the epic closeout backlog.
