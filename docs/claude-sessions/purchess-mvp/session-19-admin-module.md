---
depends_on: [07, 11]
touches:
  - "apps/api/src/admin/**"
  - "apps/api/src/admin/admin.module.ts"
  - "apps/api/src/admin/admin.controller.ts"
  - "apps/api/src/admin/admin.service.ts"
  - "apps/api/src/admin/dto/**"
  - "apps/api/src/admin/audit.service.ts"
  - "apps/api/test/admin/**"
  - "apps/web/src/app/admin/**"
  - "apps/web/src/app/admin/page.tsx"
  - "apps/web/src/app/admin/users/page.tsx"
  - "apps/web/src/app/admin/users/[username]/page.tsx"
  - "apps/web/src/app/admin/games/page.tsx"
  - "apps/web/src/app/admin/games/[gameId]/page.tsx"
  - "apps/web/src/components/admin/**"
  - "apps/web/src/components/admin/admin-shell.tsx"
  - "apps/web/src/components/admin/users-table.tsx"
  - "apps/web/src/components/admin/games-table.tsx"
  - "apps/web/src/components/admin/disable-account-dialog.tsx"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 19: Admin Module

## Mission

Build a small, functional admin surface. The MVP doesn't need pretty dashboards — it needs: search users, view their games, disable or re-enable accounts, view reports, and inspect any game record. Every action is logged for audit.

Admin access is gated by `isAdmin = true` on the user record (seeded in Session 02).

## Tasks

1. **Backend** (`apps/api/src/admin/`):
   - `admin.module.ts`, `admin.service.ts`, `admin.controller.ts`.
   - All routes under `/api/admin/*`, guarded by `AdminGuard` (Session 04).
   - `audit.service.ts` writes an `AdminAuditLog` row for every mutating action.
2. **REST endpoints**:
   - `GET /api/admin/users` — paginated, supports `?q=<search>` (matches username or email), `?disabled=true|false`. Returns `{ users, page, pageSize, total }`.
   - `GET /api/admin/users/:id` — full user record including disabled status, join date, last login, ratings, OAuth accounts.
   - `POST /api/admin/users/:id/disable` — body: `{ reason }`. Sets `isDisabled = true`, invalidates all sessions for that user, logs audit. Disallowed for self-disable.
   - `POST /api/admin/users/:id/enable` — re-enables. Logs audit.
   - `GET /api/admin/games` — paginated, supports `?userId=`, `?status=`, `?category=`, `?isRated=`, date range.
   - `GET /api/admin/games/:id` — full game record with all moves, both players' metadata, fair-play signals.
   - `GET /api/admin/queues` — current matchmaking queue state (counts per bucket, oldest wait time).
   - `GET /api/admin/active-games` — count and a sample of currently active games (with last move timestamp).
3. **Audit log**:
   - Every mutating endpoint writes to `AdminAuditLog` with `adminUserId`, `action`, `targetType`, `targetId`, `payload`.
   - Read endpoint `GET /api/admin/audit?adminUserId=&action=` (paginated).
4. **Session invalidation on disable**:
   - On `disable`, delete all `Session` rows for the user and publish a Redis event `user-disabled:<id>` so the realtime layer (Session 06) can force-disconnect any active sockets and end their active games (with reason `abandoned` after a 5s grace).
5. **Frontend** (`apps/web/src/app/admin/`):
   - All routes behind `RequireAdmin` (variant of `RequireAuth` that also checks `isAdmin`).
   - Layout: sidebar with sections Users, Games, Reports, Queues, Audit log.
   - Users table: username, email, joined, last seen, ratings, disabled badge. Search box, "Disable/Enable" action.
   - User detail: profile + recent games + reports against them.
   - Games table: ID, white, black, category, time control, result, ended at. Click → review-style page (read-only board, all moves).
   - Disable account dialog: text reason, confirm. Reversible.
6. **Admin user seeding**:
   - Seed (Session 02) creates `admin@purchess.local` with `isAdmin = true`. Document the dev password in `.env.example`.
7. **Tests**:
   - Backend: each endpoint requires admin (403 for non-admin), pagination works, disable invalidates sessions, audit log written.
   - Frontend: search filters, disable flow, table pagination.
8. **Verification**:
   - Manual: non-admin gets 403, admin can disable a test user and confirm their next request returns 401 (sessions revoked).

## Deliverables

- Admin REST API with audit logging.
- Admin web pages with search and moderation actions.
- Session invalidation wired through Redis pub/sub.

## Notes for Downstream Sessions

- Session 20 (reports) writes through this admin module's reports endpoints and surfaces in the admin UI's "Reports" tab.
- The admin "view a game" view reuses Session 18's review board in read-only mode.
- Do not build a fancy RBAC system. `isAdmin: boolean` is enough for MVP.
- Self-disable is forbidden at the API level (defense against accidental lockout).
- Audit log is append-only. No delete endpoint.

## Out of scope (defer)

- Multi-role permissions (mod vs admin).
- Bulk actions.
- Email templates for disable notifications.
- A "shadow ban" / "limited account" state.
