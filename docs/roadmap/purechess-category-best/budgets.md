# Purechess "Category Best" — Performance & Reliability Budgets

**Authored:** Session 01 (charter + baselines), 2026-06-10.
**Scope:** Hard numeric budgets sessions 02–06 must hold or improve. No new features —
every budget hardens an existing surface. "The board is the product": board routes must
out-perform chess.com and lichess.org on First Load JS and LCP.

All numbers below were **measured today** in this worktree. Reproduce with the exact
commands in each section. A budget is never set above the measured value: the **hard
ceiling = today's baseline** (CI fails on regression); the **target** is the ratchet-down
goal, and the gap between them is tracked **debt**.

---

## 1. Bundle — First Load JS per route

**Command (reproduce):**
```bash
cd apps/web && pnpm build      # no bundle analyzer is wired; ANALYZE flag does NOT exist
# read the "First Load JS" column from the printed Route (app) table
```
Next.js 14.2.4, production build, `output: 'standalone'`. Shared-by-all baseline = **204 kB**
(chunks: `3607` 109 kB + `6420bbf7` 53.8 kB + `f71b5fc5` 37.8 kB + 2.97 kB). **This 204 kB
shared floor caps every route** — no route can drop below it without shrinking the shared
bundle first (Sentry + PostHog + framework live there). Shrinking shared is itself a debt item.

| Route | Baseline (measured) | Hard ceiling (no-regression) | Target (ratchet) | Debt |
|---|---|---|---|---|
| `/` | **348 kB** | 348 kB | ≤ 240 kB | −108 kB |
| `/play` | **304 kB** | 304 kB | ≤ 240 kB | −64 kB |
| `/games` | **294 kB** | 294 kB | ≤ 240 kB | −54 kB |
| `/analyze` | **356 kB** | 356 kB | ≤ 250 kB | −106 kB |
| `/play/[gameId]` | **297 kB** | 297 kB | ≤ 250 kB | −47 kB |
| `/computer-game/[gameId]` | **283 kB** | 283 kB | ≤ 250 kB | −33 kB |
| _shared-by-all_ | **204 kB** | 204 kB | ≤ 175 kB | −29 kB |

**Rationale for ceilings.** Static/list routes target **≤ 240 kB**, interactive board
routes (`/analyze`, `/play/[gameId]`, `/computer-game/[gameId]`) target **≤ 250 kB**. The
plan's original 180 kB static ceiling is **infeasible**: it is below the 204 kB shared floor.
Targets are therefore set relative to that floor, and reducing shared (lazy-load Sentry/PostHog,
split `chess.js`/Stockfish glue out of first load) is the highest-leverage lever — it pays down
every route at once. `/` and `/analyze` are the worst offenders (348/356 kB) and should be the
first to chase the target.

**No-regression gate.** Any session that pushes a route's First Load JS above its hard ceiling
must justify it in its handoff or revert. Re-measure with the command above.

---

## 2. Lighthouse — performance & accessibility floors

**Charter floors (targets):** performance **≥ 95**, accessibility **≥ 95**, on `/` and on a
computer-game page.

**Command (reproduce):**
```bash
cd apps/web && PORT=3100 pnpm build && PORT=3100 pnpm start   # prod mode, NOT dev (dev penalises perf)
npx --yes lighthouse http://localhost:3100/ \
  --chrome-flags="--headless=new" \
  --only-categories=performance,accessibility --output=json
```

| URL | Perf (base → floor) | A11y (base → floor) | LCP | TBT | CLS | FCP / SI |
|---|---|---|---|---|---|---|
| `/` | **78** → 95 | **95** → 95 ✅ | 6.3 s | 20 ms | 0 | 1.1 s / 1.3 s |
| `/play` (board proxy) | **78** → 95 | **100** → 95 ✅ | 6.0 s | 10 ms | 0 | — |
| `/computer-game/[gameId]` | **to capture** | **to capture** | — | — | — | — |

**Baselines vs floors.**
- **Accessibility already meets the floor** (95–100). Hold it — no session may regress a11y
  below 95. Re-run after any markup/ARIA/contrast change.
- **Performance is in debt: 78 vs the 95 floor (−17 pts).** The single dominant cause is
  **LCP ≈ 6.0–6.3 s**; TBT (10–20 ms) and CLS (0) are already excellent. LCP is the whole
  fight. Likely levers: the 204 kB shared bundle (render-blocking), font loading strategy,
  and the hero/board paint path. A perf-owning session should target LCP **≤ 2.5 s** (the
  Lighthouse "good" boundary) — that alone lifts perf into the 90s.
- **Computer-game page Lighthouse is NOT yet captured.** The route is dynamic and renders no
  content for an unseeded/unauthenticated id — `lighthouse http://localhost:3100/computer-game/<probe>`
  fails with `NO_FCP` ("did not paint any content"). To capture honestly, seed a computer game
  and authenticate the Lighthouse run (session cookie), then point Lighthouse at the real
  `gameId`. Command for a seeded run:
  ```bash
  # after seeding a game + obtaining a purechess_session cookie:
  npx --yes lighthouse http://localhost:3100/computer-game/<REAL_GAME_ID> \
    --chrome-flags="--headless=new" \
    --extra-headers='{"Cookie":"purechess_session=<TOKEN>"}' \
    --only-categories=performance,accessibility --output=json
  ```
  Until seeded, `/play` (perf 78 / a11y 100 / LCP 6.0 s) stands as the reachable
  interactive-board proxy baseline.

---

## 3. Move latency (no new instrumentation — task: "instrument nothing")

Paths read from `apps/web/src/app/(play)/play/[gameId]/live-game-client.tsx`; timing anchor
~11 ms WS push from `.wolf/memory.md`.

| Path | Mechanism | Cost |
|---|---|---|
| **input → optimistic render** | `handleMove` (L405): local `chess.js` move → synchronous `setState` with optimistic FEN, **no network** (L411-433). Piece lands instantly. | Sub-frame; next React commit (~1 ms local). **Target: ≤ 1 frame (16 ms).** |
| **server push → render** | `useGameSocket.onState` → `isStaleState` guard → `setState` merge (live-game-client L261-274). | **~11 ms** observed on LAN (`.wolf/memory.md`); ≈ network RTT in prod (Fly edge ~220 ms via Frankfurt). **Target: ≤ 1 frame after receipt.** |
| **move POST round-trip** | `submitPvpMove` awaits authoritative state, reconciles (L434-436); rollback + guarded `refetchState()` on reject (L437-448). | Server internal ~10 ms + RTT; writes ≈ RTT + ~60 ms Neon (us-east-2). |

**Budget.** Optimistic render is already instant and must stay synchronous (never gated on
the POST). Every server-state merge must keep going through `isStaleState` (sacred guard — do
not regress). No latency regression: the optimistic path must not acquire a network dependency.

---

## 4. Reliability — reconnect-to-resync < 2 s

**Target: a dropped socket re-establishes and the client holds authoritative state again in < 2 s.**

**Baseline (read from source, not yet load-tested):**
- `apps/web/src/hooks/use-game-socket.ts` calls `io(WS_URL, { withCredentials: true,
  transports: ['websocket','polling'] })` with **no explicit reconnection options** → socket.io
  **defaults**: `reconnection: true`, `reconnectionAttempts: Infinity`,
  `reconnectionDelay: 1000 ms` (jittered 0.5–1.5 s by `randomizationFactor 0.5`),
  `reconnectionDelayMax: 5000 ms`, handshake `timeout: 20000 ms`.
- On reconnect, the `connect` handler re-emits `WsEvent.GameJoin` and (since `hadConnected`)
  calls `onResync()` → guarded REST refetch (L274). So **resync = reconnect delay (~1 s base)
  + handshake + one REST `GET` of authoritative state.**
- `apps/api/src/realtime/realtime.gateway.ts` `@WebSocketGateway` sets **no ping options** →
  socket.io defaults `pingInterval: 25000 ms`, `pingTimeout: 20000 ms`. **Server-side dead-peer
  detection can take up to ~45 s** — a reliability gap: a half-open connection lingers. The
  client detects faster via its own heartbeat, but presence accuracy for the opponent suffers.

**Debt / levers for the reliability-owning session:**
1. The < 2 s target is met on a **warm** path (1 s reconnect delay + ~fast REST). It is at risk
   on **Neon cold-wake (0.5–2 s autosuspend wake**, `.wolf/cerebrum.md`) when the resync REST
   hits a cold DB — worst case blows the budget. Mitigate with a connection keep-warm or a
   cached/last-known-good state on resync.
2. Tighten `pingInterval`/`pingTimeout` on the gateway so a dead peer is detected in **seconds,
   not ~45 s**, improving presence correctness and freeing rooms.
3. Consider lowering `reconnectionDelay` (e.g. 500 ms) to shave the reconnect floor, balanced
   against thundering-herd on a mass disconnect.

**No-regression:** the socket is a low-latency layer only — REST stays source of truth. Any
change must preserve graceful degradation (dead socket → polling, never broken play) and the
`onResync` guarded-merge path.

---

## 5. Why these numbers — chess.com / lichess comparison rationale

- **lichess.org** is the speed bar: lean, SSR-first, minimal JS, board paints fast. Our board
  routes (283–356 kB First Load) are **heavier than lichess** today — the 204 kB shared bundle
  (Sentry + PostHog + framework) is the gap. Matching lichess means paying down shared and
  hitting the ≤ 250 kB board target + LCP ≤ 2.5 s.
- **chess.com** is heavier and feature-dense; it is the bar we should already beat on First Load
  and LCP. Beating it is necessary but not sufficient — lichess is the real target.
- "The board is the product" → board routes get the **strictest** First Load and LCP budgets,
  and the optimistic-render path must stay instant (already is). Reliability (< 2 s resync,
  fast dead-peer detection) is where we can be **categorically better than both**: an
  authoritative-server + optimistic-client design that degrades to polling and never breaks.

---

## 6. Budget summary (the contract for sessions 02–06)

| Budget | Value | Baseline today | Status |
|---|---|---|---|
| `/` First Load JS | ≤ 240 kB (ceiling 348) | 348 kB | debt −108 |
| `/play` First Load JS | ≤ 240 kB (ceiling 304) | 304 kB | debt −64 |
| `/games` First Load JS | ≤ 240 kB (ceiling 294) | 294 kB | debt −54 |
| `/analyze` First Load JS | ≤ 250 kB (ceiling 356) | 356 kB | debt −106 |
| `/play/[gameId]` First Load JS | ≤ 250 kB (ceiling 297) | 297 kB | debt −47 |
| `/computer-game/[gameId]` First Load JS | ≤ 250 kB (ceiling 283) | 283 kB | debt −33 |
| shared-by-all | ≤ 175 kB (ceiling 204) | 204 kB | debt −29 |
| Lighthouse perf (`/`, computer-game) | ≥ 95 | 78 (`/`), CG to-capture | debt −17 |
| Lighthouse a11y (`/`, computer-game) | ≥ 95 | 95–100 | ✅ hold |
| LCP (board + `/`) | ≤ 2.5 s | ~6.0–6.3 s | debt −3.5 s |
| input → optimistic render | ≤ 16 ms (1 frame) | ~1 ms | ✅ hold |
| server push → render | ≤ 16 ms after receipt | ~11 ms LAN | ✅ hold |
| reconnect → resync | < 2 s | warm ✅, cold-Neon at risk | hold + harden |
| dead-peer detection (server) | seconds | ~45 s (socket.io default) | debt |
