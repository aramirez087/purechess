---
depends_on: [02, 05]
touches:
  - "apps/api/src/ratings/**"
  - "apps/api/src/ratings/ratings.module.ts"
  - "apps/api/src/ratings/ratings.service.ts"
  - "apps/api/src/ratings/glicko2.ts"
  - "apps/api/src/ratings/rating-snapshot.service.ts"
  - "apps/api/test/ratings/**"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 10: Rating System (Glicko-2)

## Mission

Implement Glicko-2 ratings per category (bullet, blitz, rapid) with rating deltas surfaced after every rated game. This is the only piece of the system that mutates a user's rating.

The implementation must be deterministic, well-tested, and isolated from the rest of the game code so it can be reasoned about independently.

## Tasks

1. **RatingsModule** (`apps/api/src/ratings/`):
   - `ratings.service.ts` — public API: `getOrCreate(userId, category)`, `applyGameResult(game)`, `getForUser(userId)`.
   - `glicko2.ts` — pure implementation of the Glicko-2 algorithm. No I/O.
   - `rating-snapshot.service.ts` — writes `RatingHistory` rows.
2. **Glicko-2 implementation** (`glicko2.ts`):
   - Port the canonical algorithm (Glickman). Pure functions, no state.
   - Default system constants: `τ = 0.5`, initial rating 1500, initial RD 350, initial volatility 0.06.
   - For a single rated game with one opponent:
     - Convert to Glicko-2 scale (μ, φ).
     - Compute `g(φ)`, `E(μ, μj, φj)`, update v, Δ, σ_new.
     - Convert back to rating scale.
   - Multi-game rating periods: in MVP, we apply one game at a time. Treat each rated game as a new rating period of size 1.
   - Inactivity: if a user has not played in `inactivityDays` (14), RD grows by `sqrt(φ² + σ²)` capped at 350.
3. **Schema reads/writes**:
   - `getOrCreate(userId, category)` — finds or creates a `Rating` row with category-specific defaults.
   - `applyGameResult(game)`:
     1. Load ratings for both players in the game's category.
     2. Compute the new ratings.
     3. Persist updated `Rating` rows + `RatingHistory` rows in a transaction.
     4. Return `{ whiteRatingBefore, whiteRatingAfter, blackRatingBefore, blackRatingAfter, whiteDelta, blackDelta }`.
   - Skip if `!game.isRated`. Skip if either player is anonymous.
4. **Initial ratings**:
   - First-time player: rating 1500, RD 350, volatility 0.06.
   - Subsequent games update using the algorithm.
5. **Inactivity**:
   - On every read, if `now - lastRatedGameAt > 14d`, apply RD inflation up to 350.
   - For MVP, this can be lazy (computed on read); a cron job is not required.
6. **Shared types** (`packages/shared/src/rating.ts`):
   - `RatingSnapshot`, `RatingDelta`, `RatingCategory`.
7. **Tests** (`apps/api/test/ratings/`):
   - Pure algorithm tests: known-input/known-output against published Glicko-2 examples.
   - Inactivity RD inflation.
   - `getOrCreate` idempotent.
   - `applyGameResult` updates both players, writes history rows, is transactional.
   - Casual games do not change ratings.
   - Anonymous games do not change ratings.
   - Draw returns both players closer to average.
8. **Verification**:
   - `applyGameResult` is deterministic — same input always produces same output.
   - Performance: `applyGameResult` < 5ms for two players.
   - Coverage ≥ 95% on `glicko2.ts`.

## Deliverables

- `RatingsModule` and `RatingsService` wired.
- Pure `glicko2.ts` with no external state.
- `RatingHistory` rows appended on every rated game.
- Test suite matching published Glicko-2 worked examples.

## Notes for Downstream Sessions

- `MatchmakingService` (Session 09) calls `RatingsService.getOrCreate(userId, category)` to get the rating used for range expansion. This is a read, not a write.
- `GameService.completeGame` (Session 08) calls `RatingsService.applyGameResult(game)` and stores the result deltas on the `Game` row.
- The `Game` row stores `whiteRatingBefore` / `whiteRatingAfter` / etc. for review and history display. These come from the snapshot returned by `applyGameResult`.
- Do not import `RatingsService` from a controller — it's an internal service. Endpoints reading ratings go through `UsersService` (Session 07) which calls `RatingsService` internally.
- Volatility changes are small in MVP (single game per period). Don't overthink the system constant `τ`; 0.5 is fine.
