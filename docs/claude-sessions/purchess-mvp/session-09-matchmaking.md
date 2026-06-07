---
depends_on: [06, 07, 10]
touches:
  - "apps/api/src/matchmaking/**"
  - "apps/api/src/matchmaking/matchmaking.module.ts"
  - "apps/api/src/matchmaking/matchmaking.service.ts"
  - "apps/api/src/matchmaking/matchmaking.gateway.ts"
  - "apps/api/src/matchmaking/queue.repository.ts"
  - "apps/api/src/matchmaking/matching.algorithm.ts"
  - "apps/api/test/matchmaking/**"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 09: Matchmaking Service

## Mission

Pair players quickly and fairly. The matchmaking service reads players from per-(category, rated/casual) queues, expands the rating range over time, and hands matched pairs to `GamesService` to start a game.

The key UX promise: under typical load, a user is playing within 10 seconds.

## Tasks

1. **MatchmakingModule** (`apps/api/src/matchmaking/`):
   - `matchmaking.service.ts` — owns queue lifecycle, expansion, and pairing.
   - `matchmaking.gateway.ts` — exposes queue state to the client.
   - `queue.repository.ts` — Redis-backed queue storage.
   - `matching.algorithm.ts` — pure functions to find pairs and expand ranges.
2. **Queue topology** (Redis):
   - One Redis sorted set per (category × rated) bucket, e.g. `mm:queue:bullet:rated`, `mm:queue:blitz:casual`.
   - Score is the enqueue timestamp; member is `userId` (or `anonId`).
   - Per-user key `mm:user:<userId>` stores `{ category, isRated, rating, joinedAt, expandedTo }` as a hash with TTL.
   - Anonymous users are matched only into casual buckets and never paired against each other in rated mode (rated requires auth).
3. **Time control categories** (from PRD):
   - `bullet: 1+0`
   - `blitz: 3+0, 3+2, 5+0`
   - `rapid: 10+0, 15+10`
   - The user picks a specific control; matchmaking pairs within the same control set, but for MVP we may collapse to category-level matching (3+0 vs 5+0 both go into `blitz` queue). Document the choice.
4. **Queue entry**:
   - Client emits `matchmaking:join` `{ category, timeControlSeconds, incrementSeconds, isRated }`.
   - Server validates (auth required if `isRated`; anon allowed if not).
   - Looks up user's rating for the category (or 1500 default if no record).
   - Reject if user already in any queue.
   - Add to sorted set; record user state; broadcast `matchmaking:state` to `user:<id>`.
5. **Pairing algorithm** (`matching.algorithm.ts`):
   - Pure function: `findPairs(queue, nowMs) → Array<{ userId, opponentId, expandedTo }>`.
   - Default rule (per PRD):
     1. t < 5s: range ±100
     2. 5s ≤ t < 10s: range ±200
     3. 10s ≤ t < 15s: range ±300
     4. 15s ≤ t < 30s: range ±500
     5. t ≥ 30s: pair with best available opponent in queue (any rating).
   - Always prevent `userId === opponentId`.
   - Greedy match: oldest waiting first.
6. **Loop**:
   - `MatchmakingService` runs an internal `setInterval(1000)` (one tick per second).
   - For each bucket, calls `findPairs` and for each pair:
     - Atomically remove both users from the queue (`ZREM` in a Lua script for atomicity).
     - Call `GamesService.createGame({ whiteId, blackId, timeControl, increment, isRated, category })`.
     - If rated, ratings are pre-snapshotted on game create (passed through; Session 10 handles the actual rating update on completion).
     - Emit `matchmaking:found` to both `user:<id>` rooms with `{ gameId, opponent }`.
   - Idempotency: re-entry into the same queue with a new state resets the wait timer.
7. **Cancel**:
   - `matchmaking:cancel` event — removes user from any queue. Always succeeds.
   - `matchmaking:state` is broadcast on every join, tick where the user's wait time crosses a threshold, and on match found.
8. **Self-match prevention** (defense in depth — server-side):
   - Algorithm skips any pair where the two userIds are equal. (Theoretically impossible since one user is one queue entry, but cheap to assert.)
9. **Estimates**:
   - Server pushes a "queue position" estimate (ordinal of user in queue, not absolute) and current wait time.
   - Do not promise a specific wait time; just show what the client needs to know.
10. **Tests** (`apps/api/test/matchmaking/`):
    - Single user: never matched, sits in queue, can cancel.
    - Two users within range: matched within 1 tick.
    - Two users outside range: not matched at t=0, matched at t=5s after expansion.
    - Three users with skewed ratings: closest pair matched first.
    - Rated queue rejects anonymous user.
    - Same user cannot enter two queues.
    - Self-match guard.
    - Cancel: removes from queue, no match emitted.
    - Concurrency: 100 simultaneous enqueues, all paired correctly without duplicates.
11. **Verification**:
    - 2 socket clients with different categories match into the right game.
    - Cancel mid-queue stops the match.
    - Anonymous + authed casual game is allowed.
    - Authed user without ratings is matched at rating 1500.

## Deliverables

- `MatchmakingModule` and `MatchmakingGateway` wired.
- Redis queues with the expansion algorithm.
- Tested concurrent behavior.

## Notes for Downstream Sessions

- `MatchmakingService` does **not** know about WebSockets directly except through the gateway. All queue storage is in Redis.
- When a match is found, the gateway hands off to the client, which navigates to `/play/<gameId>`. The actual game session is established when both clients emit `game:join`.
- The PRD's expansion schedule is encoded in a single table. If you want to tune, change the table — that's the whole knob.
- For MVP, do not implement cross-category matching (e.g., a blitz player waiting long enough to get a rapid game). One queue per category, period.
- Anonymous users' "rating" is always null/1500 placeholder; they will only ever match with each other or with authed users who accept casual play.
