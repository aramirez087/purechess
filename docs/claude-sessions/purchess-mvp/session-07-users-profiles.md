---
depends_on: [02, 04]
touches:
  - "apps/api/src/users/**"
  - "apps/api/src/users/users.module.ts"
  - "apps/api/src/users/users.controller.ts"
  - "apps/api/src/users/users.service.ts"
  - "apps/api/src/users/dto/**"
  - "apps/api/test/users/**"
  - "packages/shared/src/user.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 07: Users Module & Profile API

## Mission

Expose the user-facing reads and writes for accounts and profiles: fetch a user by username, update the current user's profile, list a user's recent games, and compute aggregate stats. The actual game/rating reads come from Sessions 10/11 — this session wires the controllers and the read-side helpers.

## Tasks

1. **UsersModule** (`apps/api/src/users/`):
   - `users.service.ts` — Prisma-backed read/write helpers.
   - `users.controller.ts` — REST endpoints.
   - `dto/` — `UpdateProfileDto`, query DTOs for pagination and game-history filters.
2. **REST endpoints** (all under `/api/users`):
   - `GET /api/users/me` — returns `SafeUser` (or 401). Used by client to bootstrap session.
   - `PATCH /api/users/me` — body: `{ username?, avatarUrl? }`. Username changes follow the same rules as registration and require password confirmation if changing to a name that conflicts with an existing user (rate-limited).
   - `GET /api/users/:username` — public profile. Returns:
     ```ts
     type PublicProfile = {
       user: SafeUser;
       joinedAt: string;
       ratings: { bullet: number, blitz: number, rapid: number };
       stats: { games: number, wins: number, losses: number, draws: number, winRate: number };
       recentGames: PublicGameSummary[];  // last 10
     };
     ```
   - `GET /api/users/:username/games` — paginated game history with filters: `?category=bullet|blitz|rapid&rated=true|false&page=1&pageSize=20`. Returns `{ games: PublicGameSummary[], page, pageSize, total }`.
   - `GET /api/users/:username/stats` — aggregate stats: total games, wins/losses/draws, win rate, longest streak, current streak. Computed via Prisma aggregate; for MVP, single SQL query is fine.
3. **PublicGameSummary shape**:
   ```ts
   type PublicGameSummary = {
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
     endedAt: string | null;
     moveCount: number;
   };
   ```
4. **Privacy**:
   - Email is never returned in any public payload.
   - Disabled accounts (`isDisabled = true`) return 404 to non-admin viewers.
5. **Pagination & sorting**:
   - Default sort: `createdAt DESC` (most recent first).
   - Cursor pagination is fine; offset is acceptable at MVP scale.
6. **Shared types** (`packages/shared/src/user.ts`):
   - `SafeUser`, `PublicProfile`, `PublicGameSummary`, `UserStats`, `UpdateProfileDto`.
7. **Tests** (`apps/api/test/users/`):
   - `GET /me` works for authed, 401 for anon.
   - `PATCH /me` updates username (and rejects invalid), updates avatar URL.
   - `GET /:username` returns full profile with correct aggregates from seed data.
   - `GET /:username/games` filters by category and rated, paginates correctly.
   - Disabled user returns 404.
   - Non-admin cannot view disabled user.
8. **Verification**:
   - All endpoints return expected shapes against seed data.
   - Aggregate stats match manually-computed values for seed games.
   - No PII leaks in payloads (test: response JSON does not contain `email` or `passwordHash` for any user).

## Deliverables

- `UsersModule` exporting `UsersService` and the controller.
- Public profile + game history endpoints usable by Sessions 17 and 18.
- `PublicProfile` and `PublicGameSummary` types in shared.
- Tests covering happy path and privacy guarantees.

## Notes for Downstream Sessions

- `UsersService.findPublicProfile(username)` is the canonical lookup. Don't write ad-hoc joins in controllers.
- Stats are recomputed on read. If this becomes slow, cache in Redis with a 60s TTL — but not in MVP.
- The session **does not** modify the `Rating` table — that's the rating system (Session 10) writing through `RatingsService`. This session only reads.
- `GET /me` is called by every authenticated client on app load. Keep it cheap: a single Prisma `findUnique` and a parallel `findMany` for ratings.
- Avatar uploads are out of scope for MVP. `avatarUrl` is a plain string; users paste a URL or we accept a generated initials avatar server-side.
