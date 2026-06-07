# Purchess Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare CDN / WAF                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
   ┌──────▼──────┐                  ┌───────▼──────┐
   │  Next.js 14  │                  │  NestJS 10   │
   │  (port 3000) │ ←── REST/WS ───► │  (port 4000) │
   │  App Router  │                  │  Socket.IO   │
   └─────────────┘                  └──────┬───────┘
                                           │
                              ┌────────────┼────────────┐
                              │            │            │
                       ┌──────▼─────┐ ┌───▼───┐ ┌──────▼──────┐
                       │  Postgres   │ │ Redis │ │   Supabase  │
                       │   (Neon)    │ │       │ │    Auth      │
                       └────────────┘ └───────┘ └─────────────┘
```

---

## Data Flows

### 1. Anonymous Casual Game

```
Browser A                    API                        Browser B
   │                          │                              │
   ├── POST /matchmaking/join ─►                             │
   │                          │◄── POST /matchmaking/join ──┤
   │                          │                              │
   │         (queue match)    │                              │
   │                          ├─── emit game:matched ───────►│
   │◄── emit game:matched ───┤│                              │
   │                          │                              │
   ├── navigate /games/:id ──►│◄── navigate /games/:id ─────┤
   │                          │                              │
   ├── WS move:submit ───────►│                              │
   │                          ├── validate move (chess.js)   │
   │                          ├── persist Move row            │
   │                          ├── emit move:applied ────────►│
   │◄── emit move:applied ───┤│                              │
```

### 2. Rated Game (Alice vs Bob)

Same as casual with two additions:
- Matchmaking filters by `isRated: true` and `category` + `timeControlSeconds`
- After game completion, `RatingsService.processGameResult()` runs Glicko-2, writes `Rating` + `RatingHistory`, emits `rating:updated` to both clients

### 3. Friend Invite

```
Alice                        API                         Bob
  │                           │                           │
  ├── POST /invites ──────────►│                           │
  │◄── { code, url } ─────────┤                           │
  │                           │                           │
  │   (Alice shares URL)       │                           │
  │                           │◄── POST /invites/:code/accept ─┤
  │                           ├── create Game (invite_pending → active)
  │◄── emit invite:accepted ──┤── emit invite:accepted ───►│
  │                           │                           │
  ├── navigate /games/:id ───►│◄── navigate /games/:id ───┤
```

---

## Game Status State Machine

```
                  ┌──────────────┐
    invite flow   │ invite_pending│
    ─────────────►│               │──── accept ────┐
                  └──────────────┘                │
                                                  ▼
    direct match ──────────────────────────► pending
                                                  │
                                             both connect
                                                  │
                                                  ▼
                                             ┌─────────┐
                                             │  active  │
                                             └────┬────┘
                              ┌──────────────┬───┴───────────┐
                              │              │               │
                         checkmate      resignation/     stalemate/
                         timeout        draw-agreement   draw rule
                              │              │               │
                              ▼              ▼               ▼
                          ┌─────────────────────────────────────┐
                          │              completed              │
                          └─────────────────────────────────────┘

    (abandonment / no moves after pending TTL → aborted)
```

---

## WebSocket Protocol

All events use the Socket.IO namespace `/` with rooms keyed by `gameId`.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `game:join` | `{ gameId }` | Join game room, start receiving events |
| `move:submit` | `{ gameId, move: { from, to, promotion? } }` | Submit a move |
| `resign` | `{ gameId }` | Resign the game |
| `draw:offer` | `{ gameId }` | Offer a draw |
| `draw:respond` | `{ gameId, accept: boolean }` | Accept or decline draw |
| `matchmaking:join` | `{ category, timeControlSeconds, incrementSeconds, isRated }` | Enter queue |
| `matchmaking:leave` | `{}` | Leave queue |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `game:matched` | `{ gameId, color, opponent }` | Match found |
| `move:applied` | `{ move, fen, pgn, whiteClockMs, blackClockMs }` | Move confirmed |
| `move:illegal` | `{ move, reason }` | Move rejected |
| `draw:offered` | `{ byColor }` | Opponent offered draw |
| `game:ended` | `{ result, reason, whiteRatingDelta?, blackRatingDelta? }` | Game over |
| `clock:tick` | `{ whiteClockMs, blackClockMs }` | Clock update (1Hz) |
| `player:disconnected` | `{ color }` | Opponent lost connection |
| `player:reconnected` | `{ color }` | Opponent reconnected |

---

## ADR-1: Server-Authoritative Game State

**Decision**: The server is the single source of truth for board position, clock state, and game result. The client uses `chess.js` only for legal-move highlighting (UX preview).

**Context**: A client-authoritative model would allow trivial cheating: a modified client could skip validation, claim illegal moves, or falsify clock readings.

**Tradeoff**: Every move incurs a round-trip (client → server → broadcast back). On a 100ms latency connection this is imperceptible. The alternative — accepting client-submitted positions — would require a full server re-validation anyway.

---

## ADR-2: Socket.IO over Raw WebSocket

**Decision**: Use Socket.IO (via `@nestjs/platform-socket.io`) rather than raw WebSocket or a custom protocol.

**Context**: The app needs: rooms (game isolation), automatic reconnection with backoff, fallback to HTTP long-polling for restricted networks, and namespace multiplexing.

**Tradeoff**: Socket.IO adds ~30KB to the client bundle and enforces its own framing. Raw WebSocket would be smaller but requires reimplementing rooms, reconnection logic, and protocol versioning. For an MVP with a small team, the library wins.

---

## ADR-3: Prisma + Postgres over MongoDB

**Decision**: Prisma ORM against Postgres (Neon serverless) for all persistent state.

**Context**: The data model is fundamentally relational: users → sessions, users → games (two FK relations), games → moves, users → ratings (per time-control category). Rating history is append-only and benefits from ACID transactions during Glicko-2 writes.

**Tradeoff**: Schema migrations are explicit and versioned (upside: full audit trail; downside: requires `prisma migrate` on each schema change). MongoDB's flexible schema would reduce migration friction but loses join semantics and ACID guarantees needed for rating updates.

---

## ADR-4: Glicko-2 over Elo

**Decision**: Use the Glicko-2 rating system for all rated games.

**Context**: Elo is simpler but treats all players as having equal uncertainty. Glicko-2 introduces a rating deviation (RD) that widens when a player is inactive and narrows with more games — giving more accurate ratings for players with few games or long absences.

**Tradeoff**: Glicko-2 has more parameters (rating, RD, volatility) and requires batching over a "rating period" for correctness. The implementation uses a simplified per-game approximation (common for real-time chess) which is a known accuracy tradeoff but acceptable for MVP.

---

## ADR-5: shadcn/ui over a Custom Component Kit

**Decision**: Use shadcn/ui (copy-owned Radix primitives + Tailwind) as the UI component foundation.

**Context**: shadcn/ui components are copied into the repo (`apps/web/src/components/ui/`), not installed as a versioned package. This means no runtime dependency, full control over styling, and Radix's battle-tested accessibility primitives.

**Tradeoff**: Components must be updated manually when upstream changes (no `npm update`). Acceptable at MVP scale; the component surface is small and stable.
