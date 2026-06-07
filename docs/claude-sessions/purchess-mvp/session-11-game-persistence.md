---
depends_on: [02, 05, 08, 10]
touches:
  - "apps/api/src/persistence/**"
  - "apps/api/src/persistence/persistence.module.ts"
  - "apps/api/src/persistence/game-persistence.service.ts"
  - "apps/api/src/persistence/pgn.service.ts"
  - "apps/api/src/persistence/fairplay-signal-collector.ts"
  - "apps/api/src/persistence/game-review.service.ts"
  - "apps/api/test/persistence/**"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 11: Game Persistence, PGN, & Fair-Play Signals

## Mission

Persist completed games, generate clean PGN, store the data needed for game review, and compute basic fair-play signals. This session is the bridge between the live game (Session 08) and the post-game reads (Sessions 17, 18, 20).

## Tasks

1. **PersistenceModule** (`apps/api/src/persistence/`):
   - `game-persistence.service.ts` — transactional writer for completed games.
   - `pgn.service.ts` — PGN generation (wraps engine builder, adds Purchess-specific headers).
   - `fairplay-signal-collector.ts` — computes simple signals from completed games.
   - `game-review.service.ts` — reads a game and returns review-shaped data.
2. **Game persistence**:
   - `persistCompletedGame(state, result, reason, ratingDeltas)` writes:
     - `Game` row (status → `completed`, result, reason, startedAt, endedAt, finalFen, pgn, rating fields).
     - `Move` rows (one per ply, with all metadata).
     - `Rating` updates via `RatingsService.applyGameResult` (called from `GamesService.completeGame`).
     - `RatingHistory` rows (one per player).
   - All in a single Prisma transaction. On failure, log and surface to caller; the in-memory state is the source of truth until the transaction succeeds.
3. **PGN service**:
   - Builds PGN with required headers plus Purchess conventions:
     - `Event "Purchess Rated Game"` or `"Purchess Casual Game"` based on `isRated`.
     - `Site "https://purchess.com/<gameId>"`.
     - `White`, `Black` — usernames.
     - `WhiteElo`, `BlackElo` — rating before game (omit if either is null).
     - `TimeControl "300+0"` etc.
     - `Result "1-0" | "0-1" | "1/2-1/2"`.
     - `UTCDate`, `UTCTime` — ISO 8601.
     - `ECO "??"` (no opening book in MVP).
   - Sanity: PGN must be parseable by `chess.js` and by a third-party PGN parser (test with `chess.js`).
4. **Game review service**:
   - `getReview(gameId, requestingUserId)` returns:
     ```ts
     type GameReview = {
       id: string;
       white: { username: string; ratingBefore: number | null; ratingAfter: number | null };
       black: { username: string; ratingBefore: number | null; ratingAfter: number | null };
       category: 'bullet' | 'blitz' | 'rapid';
       isRated: boolean;
       result: GameResult;
       resultReason: GameResultReason;
       timeControlSeconds: number;
       incrementSeconds: number;
       startedAt: string;
       endedAt: string;
       pgn: string;
       moves: WireMove[];
       finalFen: string;
     };
     ```
   - Visibility: any authed user can read any completed game by ID. (This is standard for chess sites.) Anonymous users can read but rate-limited.
5. **Fair-play signal collector** (basic, MVP-level):
   - On every completed rated game, compute and persist signals per user:
     - `low_variance_move_time`: standard deviation of move times in the first N moves (excluding first 3 opening moves). Score = max(0, 1 - σ/mean). Higher = more suspicious.
     - `abnormal_streak`: rolling 20-game win rate vs the user's overall win rate. Persist as a streak signal when the gap exceeds 25 percentage points.
     - `multi_account_ip`: requires Session 07's user record to track IPs (out of scope for this session; placeholder hook only).
     - `multi_account_fingerprint`: same.
     - `suspicious_accuracy`: requires engine eval; **out of scope for MVP**. Hook stubbed.
   - All signals stored in `FairPlaySignal` with a numeric `score` and a `payload` JSON.
   - This session ships the collector; Session 20 builds the admin UI to view signals.
6. **Tests** (`apps/api/test/persistence/`):
   - `persistCompletedGame` writes the right rows in a transaction; failure rolls back.
   - PGN: round-trip parse with `chess.js`; headers present and correct.
   - Game review: returns expected shape; private data (emails) never leaks.
   - Fair-play: low-variance signal computed for synthetic input; streak signal triggers at the right threshold.
7. **Verification**:
   - Run a full game end-to-end; the resulting `Game` row has correct PGN, moves, ratings.
   - Game review endpoint returns valid PGN parseable by a third-party.

## Deliverables

- `PersistenceModule` with `GamePersistenceService`, `PgnService`, `FairplaySignalCollector`, `GameReviewService`.
- PGN output passes round-trip parse.
- `GameReview` type in shared.
- Test coverage on transactional behavior and PGN correctness.

## Notes for Downstream Sessions

- `GameReviewService.getReview` is the read endpoint for Session 18 (game review page).
- The PGN is the source of truth for re-rendering moves. The `Move` rows are an indexed fast path; the `pgn` column is the canonical export.
- `FairPlaySignal` rows are read by Session 20 (admin reports). Don't build a fancy dashboard in this session.
- The signal collector should be cheap (sub-10ms per game). If you find yourself running a SQL window function for every completed game, push it to a background job later.
- Anon games are still persisted (so the user can review), but signals are not collected for anon vs anon games.
