---
depends_on: [03, 07, 11]
touches:
  - "apps/web/src/app/profile/**"
  - "apps/web/src/app/profile/[username]/page.tsx"
  - "apps/web/src/app/profile/me/page.tsx"
  - "apps/web/src/app/games/**"
  - "apps/web/src/app/games/page.tsx"
  - "apps/web/src/components/profile/**"
  - "apps/web/src/components/profile/profile-header.tsx"
  - "apps/web/src/components/profile/ratings-card.tsx"
  - "apps/web/src/components/profile/stats-card.tsx"
  - "apps/web/src/components/profile/recent-games.tsx"
  - "apps/web/src/components/profile/game-history-list.tsx"
  - "apps/web/src/components/profile/game-history-filters.tsx"
  - "apps/web/src/hooks/use-profile.ts"
  - "apps/web/src/hooks/use-game-history.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 17: Profile & Game History

## Mission

Build the user profile (own and public) and the game history page. These are the read surfaces of Purchess: who someone is, how they're doing, and what games they've played. Both must be SSR-friendly so they're indexable and shareable.

## Tasks

1. **Routes**:
   - `apps/web/src/app/profile/[username]/page.tsx` — public profile. SSR.
   - `apps/web/src/app/profile/me/page.tsx` — alias for the authed user's own profile. Redirects to `/profile/<username>` after fetching the user.
   - `apps/web/src/app/games/page.tsx` — game history. SSR with filters in URL params.
2. **Data hooks**:
   - `useProfile(username)` — TanStack Query wrapping `GET /api/users/:username`. Cache key `['profile', username]`.
   - `useGameHistory({ username, category, isRated, page, pageSize })` — TanStack Query wrapping `GET /api/users/:username/games`. Pagination via cursor or page.
3. **Profile page layout**:
   - Header (`profile-header.tsx`): avatar, username, join date (formatted as "Joined March 2024"), "Edit profile" button if it's the current user.
   - Ratings card (`ratings-card.tsx`): three columns — Bullet / Blitz / Rapid. Each shows current rating and games played. Compact, no chart in MVP.
   - Stats card (`stats-card.tsx`): total games, wins, losses, draws, win rate (% with one decimal). No graph.
   - Recent games (`recent-games.tsx`): last 10 games as a compact list. Each row: opponent, color badge, result, rating delta, time control, date. Click → `/games/<id>`.
4. **Public profile**:
   - Same as own profile, minus the "Edit profile" button.
   - If user is disabled and viewer is not admin, show a 404.
5. **Game history page** (`/games`):
   - Filter bar (`game-history-filters.tsx`):
     - Category pills: All / Bullet / Blitz / Rapid.
     - Type pills: All / Rated / Casual.
   - List (`game-history-list.tsx`):
     - Virtualized if > 100 rows.
     - Columns: Date, Opponent, Color, Result, Rating Δ, Time control, "Review" link.
   - Pagination: "Load more" button.
6. **My profile** (`/profile/me`):
   - For authed users, looks up the current user and redirects to `/profile/<username>`.
   - Anonymous users are redirected to `/login?return=/profile/me`.
7. **Empty states**:
   - No games yet: "You haven't played any games yet. Start with /play."
   - No games matching filters: "No games match these filters. Try clearing them."
8. **SEO**:
   - Public profile: `Metadata` with `title: "<username> on Purchess"`, `description: "<username>'s chess profile, ratings, and recent games."`. OG image is a card with username + ratings.
   - Game history: noindex.
9. **Performance**:
   - SSR with `force-dynamic` (data changes per request).
   - Cache profile data for 60s in Next's data cache; revalidate on game completion via tag-based revalidation.
10. **Accessibility**:
    - All interactive elements keyboard reachable.
    - Filter pills are toggleable buttons with `aria-pressed`.
    - Lists use semantic `<ul>`/`<li>` or `<table>` for tabular data (use `<table>` for game history with proper headers).
11. **Tests**:
    - Profile page renders all sections.
    - Filter changes update the URL and re-fetch.
    - Disabled user returns 404 to non-admin.
    - Anonymous user on `/profile/me` is redirected to `/login`.
12. **Verification**:
    - Lighthouse perf ≥ 85 on profile and history pages.
    - Manual: navigate from a game to opponent's profile to a recent game of theirs.

## Deliverables

- Public profile at `/profile/[username]`.
- Self-profile alias at `/profile/me`.
- Game history at `/games` with filters and pagination.
- SEO metadata for public profiles.

## Notes for Downstream Sessions

- The "Edit profile" CTA on the own profile opens a small dialog (built in this session) to change username and avatar URL. Saving hits `PATCH /api/users/me`. Out of scope: avatar upload, profile bio, social links.
- Recent games on the profile link to `/games/<id>` (the review page, Session 18). The review page works for any completed game ID.
- Rating deltas in the history are read from the `Game.whiteRatingAfter - Game.whiteRatingBefore` (and black equivalent) columns. No recalculation on the client.
- The profile's "Joined March 2024" date uses the user's `createdAt` formatted in their local timezone (the server returns ISO; the client formats).
