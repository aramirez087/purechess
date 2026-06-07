---
depends_on: [08, 13]
touches:
  - "apps/api/src/invites/**"
  - "apps/api/src/invites/invites.module.ts"
  - "apps/api/src/invites/invites.service.ts"
  - "apps/api/src/invites/invites.controller.ts"
  - "apps/api/src/invites/invite-gateway.ts"
  - "apps/api/test/invites/**"
  - "apps/web/src/components/play/invite-create.tsx"
  - "apps/web/src/components/play/invite-join.tsx"
  - "apps/web/src/app/invite/[token]/page.tsx"
  - "apps/web/src/app/invite/[token]/invite-accept.tsx"
  - "apps/web/src/hooks/use-invite.ts"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 21: Play a Friend (Invite Link)

## Mission

Ship the "Play a friend" flow. A user picks a time control, gets a shareable invite link, the friend opens it, and the game starts. Casual only in MVP (no friend ratings).

This is the simplest, lowest-stakes way to ship multiplayer without matchmaking, and it doubles as a viral growth surface.

## Tasks

1. **Backend** (`apps/api/src/invites/`):
   - `invites.module.ts`, `invites.service.ts`, `invites.controller.ts`, `invite-gateway.ts`.
   - `Invite` is not a separate table — it's a `Game` row with `inviteToken` set and `status = 'invite_pending'`. Token: 16 bytes, base64url, unique indexed.
2. **REST endpoints**:
   - `POST /api/invites` (auth required) — body: `{ timeControlSeconds, incrementSeconds, category }`. Creates a `Game` with `whiteUserId = me`, `blackUserId = null`, `isRated = false`, `status = 'invite_pending'`, `inviteToken = <generated>`. Returns `{ gameId, inviteToken, inviteUrl }`.
   - `GET /api/invites/:token` — returns `{ gameId, timeControl, category, creator: { username, avatarUrl }, status }`. Public endpoint (no auth) so the recipient can preview. Does not leak creator's email.
   - `POST /api/invites/:token/accept` (auth required) — sets `blackUserId = me` (or `whiteUserId` if creator chose to be black), flips status to `active`, calls `GamesService.startGame`. Reject if the acceptor is the creator. Reject if game is no longer `invite_pending`.
   - `POST /api/invites/:token/cancel` (auth required, creator only) — sets `status = 'aborted'`, deletes from Redis (not yet created there).
3. **Color choice**:
   - Creator's color is determined by an optional `?color=white|black|random` query on the create endpoint. Default `random`.
   - The `?color=random` case picks white/black at accept time using server-side randomness.
4. **Invite expiration**:
   - `createdAt + 24h` — if not accepted, the game is auto-aborted. A background job (or lazy check on read) handles this.
5. **Invite gateway** (`invite-gateway.ts`):
   - On `invite:created` to the creator's `user:<id>` room: `{ gameId, inviteUrl }`.
   - On `invite:accepted` to the creator's room and the acceptor's `user:<id>` room: `{ gameId }`. Both navigate to `/play/<gameId>`.
6. **Frontend**:
   - `invite-create.tsx` — shown in `/play` when "Play a friend" mode is selected. Pick time control, pick color, "Create invite link". On success, show the URL with a Copy button and a "Waiting for opponent to join…" state.
   - `invite-join.tsx` — the landing page at `/invite/[token]`. Shows invite details (creator, time control, color you'll be). For anon, prompts to log in (or "Continue as guest" if you allow anon friends — for MVP, **require auth on accept** but allow preview without auth).
   - On accept, both clients are routed to `/play/[gameId]`.
7. **Anonymous acceptance**:
   - For MVP, both players must be authenticated to use the invite flow. Anonymous casual play still works through the casual matchmaking queue.
8. **Edge cases**:
   - Creator cancels → invite is dead. Trying to accept returns 410 Gone.
   - Inviter disconnects after creating but before accepting — that's fine, the invite lives in Postgres.
   - Two people click accept at the same time → first write wins (Prisma `update` with `where: { id, status: 'invite_pending' }` — affects 0 rows on the second, return 409).
9. **Tests**:
   - Create invite: success, returns token.
   - Get invite by token: works without auth, hides email.
   - Accept: success, game status flips, both clients get `invite:accepted` (verified via socket).
   - Reject: same user accepts (creator), second user accepts (race), expired invite.
   - Cancel: only creator can cancel.
10. **Verification**:
    - Manual: user A creates invite, copies URL, user B opens URL on another device, accepts, both land in the game.

## Deliverables

- Friend invite REST + WebSocket surface.
- `/invite/[token]` landing page.
- "Play a friend" entry in `/play` wired end-to-end.

## Notes for Downstream Sessions

- The friend game is a regular `Game` row — it appears in both players' game history with `isRated = false`. Reviews work the same way.
- The invite is **not** a way to bypass auth for rated play; rated requires the matchmaking queue, not a friend link. Casual is the only mode here.
- We do not build a "friends list" in MVP. Invites are one-shot links.

## Out of scope (defer)

- Friends list / social graph.
- Reusable invites (same link can be used N times).
- Spectator invites.
- Team / club invites.
