---
depends_on: [02, 04]
touches:
  - "apps/api/src/realtime/**"
  - "apps/api/src/realtime/realtime.module.ts"
  - "apps/api/src/realtime/gateway/base.gateway.ts"
  - "apps/api/src/realtime/gateway/session-auth.adapter.ts"
  - "apps/api/src/realtime/redis-io.adapter.ts"
  - "apps/api/src/realtime/presence.service.ts"
  - "apps/api/test/realtime/**"
parallel_safe: true
model: sonnet
cli: opencode
---

# Session 06: Realtime Infrastructure

## Mission

Stand up the Socket.IO gateway that powers all real-time features: live game state, matchmaking notifications, presence, and reconnection. This session ships the **transport layer** only — game-specific events are wired in Session 08.

The gateway is server-authoritative and authenticates each connection using the same session cookie as REST, so anonymous and authed users share one transport.

## Tasks

1. **NestJS gateway scaffolding** (`apps/api/src/realtime/`):
   - `realtime.module.ts` registers `BaseGateway`.
   - `gateway/base.gateway.ts` — single `@WebSocketGateway` on namespace `/realtime` with CORS configured to allow web origin with credentials.
   - `gateway/session-auth.adapter.ts` — custom `IoAdapter` that runs the session lookup in `handleConnection` and attaches `socket.data.user` (or `null` for anonymous).
2. **Redis adapter** (`apps/api/src/realtime/redis-io.adapter.ts`):
   - Use `@socket.io/redis-adapter` (or `socket.io-redis` if newer API fits) so multiple API instances share rooms.
   - Pub/sub channels: `realtime:#<roomId>` (game room) and `realtime:user:#<userId>` (user-scoped notifications).
3. **Session auth handshake**:
   - On `connection`, read `purchess_session` cookie from `socket.handshake.headers.cookie`.
   - Look up session hash in `Session` table (reuse `AuthService` from Session 04).
   - Set `socket.data.user` (full `SafeUser`) or `null`.
   - Reject with `disconnect` if session lookup throws.
4. **Rooms and presence**:
   - `socket.join('user:' + userId)` for authed users — used to push personal events (match found, game started).
   - `socket.join('game:' + gameId)` when joining a game (called by `GameGateway` in Session 08).
   - `PresenceService` — Redis-backed `online:user:<id>` set with 30s heartbeat. `isOnline(userId)`, `markOnline(userId)`, `markOffline(userId)`. Updated by gateway on `connection` / `disconnect`.
5. **Reconnection protocol**:
   - Client emits `reconnect:game` with `{ gameId }` on socket `connect` if it has an in-progress game locally.
   - Gateway responds with current snapshot (delegates to `GameService` once Session 08 lands; for now, stubbed).
   - Heartbeat: client emits `ping` every 25s; gateway `pong`s and updates presence.
6. **Base gateway events** (this session):
   - `connect` (built-in) — sends `{ sessionExpiresAt }` if authed.
   - `disconnect` (built-in) — marks offline after 30s grace.
   - `presence:query` (in) → `presence:result` (out) — `{ userIds, onlineMap }`.
   - `error` (out) — `{ code, message }` shape; never leaks stack traces.
7. **Logging**:
   - Structured logs for `connection` / `disconnection` with `userId`, `socketId`, `ip`, `userAgent`.
   - Redact cookie value in logs.
8. **Tests** (`apps/api/test/realtime/`):
   - Connect with valid session → `socket.data.user` set, `user:<id>` joined.
   - Connect with invalid cookie → disconnect with auth error.
   - Connect anonymously → `socket.data.user === null`.
   - Two clients both join `game:abc` → receive room broadcasts.
   - `presence:query` returns expected online state after connect/disconnect.
   - Redis adapter: spawn two API instances, broadcast on one reaches the other.
9. **Verification**:
   - `pnpm dev:api` starts gateway on `:4000/realtime`.
   - A simple node client can connect with cookie + namespace, receive `connect` ack, and round-trip `presence:query`.
   - Connection rate-limited per IP (token bucket via `@nestjs/throttler` extended to WS).

## Deliverables

- `RealtimeModule` wired into `AppModule`.
- `/realtime` namespace live with session auth.
- Redis adapter for horizontal scaling.
- Presence service in Redis with TTL heartbeat.
- Test suite covering connect, auth, rooms, presence, multi-instance broadcast.

## Notes for Downstream Sessions

- `GameGateway` (Session 08) extends `BaseGateway` and adds game-specific events. Do not put game logic here.
- All events use `snake_case` (`: `) on the wire. NestJS event names map 1:1 to socket emit names.
- Payload schemas live in `packages/shared/src/realtime.ts` so the client can type them.
- Disconnect during a game is **not** a forfeit — `GameService` (Session 08) implements a reconnection grace window. The gateway just reports the disconnect; the game service decides what to do.
- If a user has multiple sockets (e.g., two tabs), broadcasts to `user:<id>` fan out to all of them. This is desirable for "match found" notifications.
