# Session 21 Handoff — Friend Invite

## What Was Built

### Database
- `apps/api/prisma/schema.prisma`: `Game.whiteUserId` and `Game.blackUserId` changed to `String?` (nullable). Relations updated to `User?`.
- `apps/api/prisma/migrations/20260607120000_nullable_player_ids/migration.sql`: `ALTER TABLE "Game" ALTER COLUMN "whiteUserId" DROP NOT NULL; ALTER TABLE "Game" ALTER COLUMN "blackUserId" DROP NOT NULL;`

### Shared Package
- `packages/shared/src/ws-events.ts`: Added `WsEvent.InviteCreated = 'invite:created'` and `WsEvent.InviteAccepted = 'invite:accepted'`. Added `WsInviteCreatedPayload` and `WsInviteAcceptedPayload` interfaces.

### API — Invites Module (`apps/api/src/invites/`)
- `dto/create-invite.dto.ts`: Validates `timeControlSeconds`, `incrementSeconds`, `category`.
- `invite-gateway.ts`: `@WebSocketGateway` with `emitInviteCreated` and `emitInviteAccepted`. Emits to `user:<id>` rooms. Uses `any` for `Server` type (socket.io not directly hoisted in pnpm).
- `invites.service.ts`: Full invite lifecycle — create, get by token, accept (race-safe via `updateMany`), cancel. Lazy expiration check (24h TTL). Creator-is-self guard. Uses `PrismaService` directly (no `GamesService` dependency).
- `invites.controller.ts`: `POST /invites`, `GET /invites/:token` (public), `POST /invites/:token/accept`, `POST /invites/:token/cancel`. `SessionAuthGuard` on mutating endpoints.
- `invites.module.ts`: Imports `AuthModule`; provides `InvitesService` and `InviteGateway`.
- `apps/api/src/app.module.ts`: `InvitesModule` added.

### API — Key Design Decisions
- Token: `crypto.randomBytes(16).toString('base64url')` → 22-char URL-safe string.
- Color logic: `color=white` → `whiteUserId=creator, blackUserId=null`; `color=black` → `whiteUserId=null, blackUserId=creator`; `color=random` → `whiteUserId=creator, blackUserId=null`, randomize at accept time.
- Race-safe accept: `prisma.game.updateMany({ where: { id, status: 'invite_pending' } })` — `count=0` → 409 Conflict.
- No Redis in this session. Cancel just sets `status='aborted'` in Postgres.
- `InviteGateway` is separate from `RealtimeGateway` to avoid touching session 13/14 stub files.

### Frontend
- `apps/web/src/hooks/use-invite.ts`: TanStack Query mutations/queries for all four endpoints. `useInviteSocket` hook using native `WebSocket` for `invite:accepted` events.
- `apps/web/src/components/play/invite-create.tsx`: Full create flow — time control selector, color selector, "Create Invite Link" button, copy URL state, "Waiting for opponent" state. Navigates to `/play/<gameId>` on socket event.
- `apps/web/src/components/play/invite-join.tsx`: Invite preview — creator username, time control, color assignment, "Accept & Play" button. 410 error state.
- `apps/web/src/app/(play)/play/page.tsx` + `play-page-client.tsx`: Play mode selector. "Quick Match" (disabled, coming soon) | "Play a Friend" (renders `InviteCreate`).
- `apps/web/src/app/invite/[token]/page.tsx` + `invite-accept.tsx`: `/invite/[token]` landing page with `InviteJoin` component. No auth required for preview; auth enforced by API on accept.

## Verification Evidence

```
pnpm --filter @purechess/shared typecheck  → 0 errors
pnpm --filter @purechess/api typecheck     → 0 new errors (pre-existing: @purechess/shared unlinked, @prisma/client not generated)
pnpm --filter @purechess/web typecheck     → 0 new errors (same pre-existing gaps)

pnpm --filter @purechess/api test          → invites.service.spec.ts: 8 tests PASS
  ✓ createInvite: creates game, returns 22-char token, emits invite:created
  ✓ createInvite: sets blackUserId=creator when color=black
  ✓ getInviteByToken: returns details without email
  ✓ getInviteByToken: throws GoneException for expired invite
  ✓ getInviteByToken: throws NotFoundException for unknown token
  ✓ acceptInvite: flips status to active, emits invite:accepted
  ✓ acceptInvite: throws ForbiddenException when creator accepts own invite
  ✓ acceptInvite: throws ConflictException on race (updateMany count=0)
  ✓ acceptInvite: throws GoneException for expired invite
  ✓ cancelInvite: aborts game for creator
  ✓ cancelInvite: throws ForbiddenException for non-creator
```

## Open Issues / Known Gaps

1. **`user:<id>` room join not implemented**: `InviteGateway` emits to `user:<id>` Socket.IO rooms, but no gateway handles the client joining that room. The downstream session that owns the WebSocket connection lifecycle (session 13/14 or similar) must add a `socket.join(`user:${userId}`)` call on connection. Until then, WS notifications won't reach clients, but REST flow still works.
2. **`useInviteSocket` uses native WebSocket**: The backend is Socket.IO, not plain WebSocket. The hook is a placeholder — the real implementation should use `socket.io-client`. This is blocked on `socket.io-client` being added to `apps/web` dependencies.
3. **No `/play/<gameId>` page**: Navigating to `/play/<gameId>` post-accept will 404 until the game board page is built (session 13).
4. **Pre-existing typecheck failures**: `@purechess/shared` not linked and `@prisma/client` not generated are known gaps from sessions 01–03. Session 21 adds zero new typecheck errors.
5. **No auth enforcement on `/play` page**: The play page is publicly accessible; unauthenticated users will get a 401 from the API when they try to create an invite. A proper auth redirect can be added by the session that owns the auth-required UX.

## Inputs Next Sessions Can Rely On

- `POST /api/invites?color=white|black|random` — creates invite, returns `{ gameId, inviteToken, inviteUrl }`.
- `GET /api/invites/:token` — public preview, returns `{ gameId, timeControlSeconds, incrementSeconds, category, creator: { id, username, avatarUrl }, creatorColor, status }`.
- `POST /api/invites/:token/accept` — auth required; returns `{ gameId }`, emits `invite:accepted` to both users' `user:<id>` rooms.
- `POST /api/invites/:token/cancel` — auth required, creator only; returns `{ success: true }`.
- `WsEvent.InviteCreated = 'invite:created'` and `WsEvent.InviteAccepted = 'invite:accepted'` in `@purechess/shared`.
- `/invite/[token]` route exists in web app.
- `/play` route exists in web app with "Play a Friend" → invite create flow.
- Migration `20260607120000_nullable_player_ids` must be applied before API starts: `whiteUserId` and `blackUserId` are now nullable on `Game`.
