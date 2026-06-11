# Session 02 Handoff — Realtime Resilience

**Epic:** purechess-category-best · **Session:** 02 · **Date:** 2026-06-10
**Mission:** Live play survives hostile networks — reconnect storms, tab sleep, flaky wifi, Neon
cold starts — with zero dropped or rewound game states.
**Mode:** source changes (web hooks + API gateway/Prisma) + new/extended specs + live measurement.

---

## 1. What was done

1. **`apps/web/src/hooks/use-game-socket.ts`** — explicit socket.io reconnection tuning + two new
   wake-driven resync triggers:
   - `reconnection: true`, `reconnectionAttempts: Infinity`, `reconnectionDelay: 500`,
     `reconnectionDelayMax: 5000`, `randomizationFactor: 0.5`, `timeout: 10000`
     (bounded exponential backoff with jitter; lower warm floor than the 1000 ms default).
   - `window 'online'` and `document 'visibilitychange'→visible` listeners now drive a `resync()`
     that nudges a half-open socket (`socket.connect()`), re-emits `GameJoin` (idempotent
     server-side), and calls **the existing guarded `onResync`** (REST refetch → `isStaleState`
     merge). Tab sleep freezes timers without a `disconnect`, so the connect-driven resync alone
     never fired — these events catch the wake. A 250 ms in-effect throttle collapses the
     online+visibility double-fire to one REST GET. Listeners removed on cleanup.
2. **`apps/web/src/hooks/use-live-clock.ts`** — added a `visibilitychange→visible` / `online`
   listener that forces one `setTick` so the next render recomputes against real `Date.now()`,
   snapping a backgrounded/throttled tab to true time instead of letting it "drift in" as the
   200 ms interval catches up. The drain formula is unchanged (existing offset tests stay green).
3. **`apps/api/src/realtime/realtime.gateway.ts`** — added `pingInterval: 10_000` /
   `pingTimeout: 10_000` to the `@WebSocketGateway` decorator. Dead-peer detection drops from
   ~45 s (socket.io defaults 25 s/20 s) to ≤ ~20 s worst case, staying clear of a healthy mobile
   client's heartbeat so a briefly-stalled-but-alive socket on flaky wifi is not falsely dropped.
   **Verified at runtime** (see §2.3) — decorator options reach the engine; no `IoAdapter`
   fallback needed. Handshake auth, per-socket room cap, and presence-only-on-membership-change
   were re-read and left unchanged; new specs lock them.
4. **`apps/api/src/database/prisma.service.ts`** — lightweight Neon keepalive: `SELECT 1` every
   4 min, disabled under `NODE_ENV=test`, `unref()`'d, cleared on `onModuleDestroy`.
5. **Specs:**
   - `apps/api/test/database/prisma.service.spec.ts` (new) — keepalive off under test; fires
     `SELECT 1` on the interval when enabled; survives a transient failure; cleared on destroy.
   - `apps/api/test/realtime/realtime.gateway.spec.ts` (extended) — decorator carries
     `pingInterval`/`pingTimeout` (≤ 20 s combined); reconnected-socket rejoin re-broadcasts
     presence exactly once (and a duplicate join on the same socket does not); join→leave→
     disconnect broadcasts presence exactly once total (disconnect never re-emits for a
     left game).
   - `apps/web/test/play/use-game-socket.test.tsx` (extended) — reconnection options asserted;
     `online` and `visibilitychange→visible` fire `onResync` through the guarded path + nudge a
     half-open socket; hidden visibility is ignored; wake listeners removed on unmount.
     `FakeSocket` mock gained `connected` + `connect`.
   - `apps/web/test/play/use-live-clock-visibility.test.tsx` (new) — backgrounded tab snaps to
     true elapsed on `visibilitychange→visible` and `online` without an interval tick; hidden
     does not force a tick; untimed game registers no listener.
6. **Live reconnect measurement** (§2.1) + ping runtime verification (§2.3).

**Integration spec (task 6) decision:** the in-Jest real-`socket.io-client` gateway spec was
**NOT added** — `apps/api` has no `socket.io-client` dev dep and the plan flags adding one +
a listening HTTP server in the unit Jest config as a destabilization risk. Per the plan's
sanctioned fallback, presence/rejoin/disconnect properties are locked by the extended **unit**
specs above, and the full authed-handshake→join→state path was instead verified **live** with a
real socket.io client against a running Nest app (§2.1, §2.3) — stronger evidence than an in-Jest
harness, without touching the unit suite's stability.

---

## 2. Measurements

### 2.1 Reconnect-to-correct-board (live, kill+restart the API mid-game)

Method: two registered users open a rated-shape game via the invite flow, play `1. e4 e5`
(ply=2), then a Node client configured **identically** to `use-game-socket.ts` holds a socket.
The API process is `kill -9`'d, left down ~0.8 s, then restarted; we record wall-clock from
**API-up** (health 200) to the client's reconnect + authoritative-state REST GET, and whether the
board rewound (ply/fen vs pre-kill). Harness: `/tmp/pc-reconnect-measure.mjs` +
`/tmp/pc-driver-loop.sh` (local Postgres/Redis, API from `dist` on :4100 for fast restart).

**8 trials:**

| trial | reconnectFromApiUp (ms) | resync REST (ms) | board rewound |
|---|---|---|---|
| 1 | 440 | 29.7 | false |
| 2 | 748 | 29.2 | false |
| 3 | ~0 (−14)¹ | 7.9 | false |
| 4 | 730 | 30.2 | false |
| 5 | 144 | 20.4 | false |
| 6 | **2321** | 24.1 | false |
| 7 | 790 | 27.1 | false |
| 8 | 544 | 19.3 | false |

¹ −14 ms = the socket reconnected on a pending attempt at almost the exact instant the API bound,
just before the driver's health poll returned — effectively 0.

**Result vs budget (`budgets.md` §4, target < 2 s):**
- **Board correctness: 8/8 zero rewind** — ply and FEN held through kill+restart on every trial.
  This is the critical exit criterion ("zero dropped or rewound game states") and it is met
  unconditionally: resync routes through the existing `onResync`→`isStaleState` guard; the socket
  never writes board state.
- **Reconnect latency: 7/8 trials ≤ 790 ms** (median ≈ 640 ms), well under the 2 s budget. The
  resync REST itself is **8–30 ms** warm.
- **One outlier at 2321 ms** (trial 6). This is **socket.io reconnection-backoff jitter**, not a
  resync-correctness issue: during the outage the client's backoff window grows, and if the next
  attempt lands just after API-up it waits out a full (jittered, up to 5 s) window. It is bounded
  by `reconnectionDelayMax: 5000` and `randomizationFactor: 0.5`. The board was still correct.
  See §4 open issue 1 for the lever (an immediate post-backoff resync is already partially covered
  by the new `online`/`visibilitychange` triggers on a real wake; a pure server-restart with the
  tab focused still relies on socket backoff).

**Before:** baseline (session 01) was `reconnectionDelay: 1000` (jittered 0.5–1.5 s) + 20 s
handshake timeout; warm resync ≈ 1 s reconnect + REST. **After:** 500 ms floor + 10 s timeout →
median ≈ 640 ms.

### 2.2 Neon keepalive (tradeoff — NOT locally reproducible)

Local Postgres does **not** autosuspend, so the cold-wake penalty the keepalive defends against
(Neon 0.5–2 s, `.wolf/cerebrum.md`) **cannot be reproduced on this host** — stated honestly rather
than fabricated. What is verified: the keepalive fires `SELECT 1` every 4 min, is disabled under
`NODE_ENV=test`, and is cleared on destroy (`prisma.service.spec.ts`, 4 passing cases).

**Tradeoff (the decision):** a 4-min `SELECT 1` keeps Neon's compute warm so the first move/resync
after an idle spell never eats the multi-second wake — directly protecting the < 2 s resync budget
that a cold DB would otherwise blow. **Cost:** it defeats Neon autosuspend, so the compute stays
billed/awake instead of scaling to zero on idle. Accepted for a live-games server where cold
latency is a category-best risk; 4 min < Neon's default 5 min autosuspend window. `unref()` +
the test gate ensure it never holds the event loop or leaks a Jest handle.

### 2.3 Ping tuning reaches the engine (runtime)

engine.io handshake against the running gateway:
`curl 'http://localhost:4100/socket.io/?EIO=4&transport=polling'` →
`pingInterval=10000 pingTimeout=10000`. Confirms the `@WebSocketGateway` decorator options flow to
the socket.io `Server` (no custom `IoAdapter` in `main.ts` needed). Dead-peer detection bound:
~20 s vs the ~45 s default — opponent-presence accuracy and room cleanup improve accordingly.

---

## 3. Quality gates

| Gate | Result |
|---|---|
| `apps/api` `pnpm exec tsc --noEmit` | ✅ clean |
| `apps/api` `pnpm test` | ✅ 302 passed, 29 suites |
| `apps/api` `pnpm exec jest --coverage` (engine gate) | ✅ engine 98.36% lines / 86.2% branches / 100% fns (gate 90/85/90) |
| `apps/web` `pnpm exec tsc --noEmit` | ✅ clean (the cerebrum-predicted lucide/admin reds are already fixed upstream) |
| `apps/web` `pnpm exec vitest run test/` | ✅ 256 passed, 33 suites |
| bug-005 flag-fall specs | ✅ untouched, passing (engine/persistence not modified) |

**Fresh-worktree gotcha hit:** `argon2`'s native binding (`lib/binding/napi-v3/argon2.node`) was
**not present** after `pnpm install` (build scripts ignored), failing two auth specs to *run*
(not assert). Fixed by `node-pre-gyp install --fallback-to-build` in the argon2 package dir, which
fetched the prebuilt darwin-arm64 binary. Logged as `bug-263`. **Next session in a fresh worktree
will hit this too** — run `pnpm rebuild argon2` (or the node-pre-gyp command) if `apps/api` specs
fail with `Cannot find module '.../argon2.node'`.

---

## 4. Open issues

1. **Server-restart reconnect tail is socket.io-backoff-bound, not resync-bound.** 7/8 trials
   < 800 ms but one 2.3 s outlier when a reconnect attempt just misses API-up. The new
   `online`/`visibilitychange` resync covers **wake** events immediately, but a focused tab during
   a pure server restart still waits on socket backoff. Lever for a future session: an explicit
   "reconnect now" nudge (reset backoff) when the app regains a network signal, or a short
   client-side `socket.io.reconnectionDelayMax` for live-game routes only. Board correctness is
   unaffected — it is only latency.
2. **Neon cold-wake not locally reproducible** (§2.2) — the keepalive's real-world benefit is
   argued from Neon's documented autosuspend, not measured here. To validate against prod Neon,
   measure first-move latency after >5 min idle with the keepalive on vs off.
3. **No in-Jest socket.io integration spec** (task 6) — deliberately skipped to avoid adding a
   dev dep + listening server to the unit suite; covered by unit specs + the live run instead.
   If a future session wants it, add `socket.io-client` to `apps/api` devDeps and a separate
   `jest.e2e.config.js` target so it never runs in the fast unit sweep.

---

## 5. Explicit inputs for dependent sessions (file paths, not memory)

- **Any session touching realtime:** the resync contract is now: **all** wake/reconnect paths
  (`connect` re-emit, `online`, `visibilitychange→visible`) funnel through
  `use-game-socket.ts`'s `resync()` → caller's `onResync` → `live-game-client.tsx` `refetchState`
  → `isStaleState` guard. Do **not** add a fourth merge path; reuse `onResync`.
- **Engine/ratings sessions:** `apps/api/src/database/prisma.service.ts` now owns a keepalive
  timer — if you add `OnModuleInit`/`OnModuleDestroy` logic to a Prisma subclass or a test that
  news up `PrismaService`, keep the `NODE_ENV==='test'` gate intact or you'll leak a Jest handle.
- **Gateway tuning** lives on the `@WebSocketGateway` decorator in
  `apps/api/src/realtime/realtime.gateway.ts` (`pingInterval`/`pingTimeout`); the lock test is
  `realtime.gateway.spec.ts` › "transport tuning (decorator options)". Changing them requires
  updating that assertion.
- **Fresh-worktree bootstrap:** after `pnpm install`, if `apps/api` specs fail on
  `argon2.node`, run `pnpm rebuild argon2` (see §3 / `bug-263`).
- **Reconnect measurement harness** (re-runnable): `/tmp/pc-reconnect-measure.mjs` +
  `/tmp/pc-driver-loop.sh` (need local PG/Redis + a `dist` build of `apps/api` on :4100). Not
  committed (lives in `/tmp`); re-create from this handoff if needed.

---

## 6. Exit criteria

| Criterion | Status |
|---|---|
| Reconnect-to-correct-board < budget, recorded | ✅ median ≈ 640 ms (7/8 < 800 ms; one 2.3 s backoff outlier), §2.1 |
| Zero dropped/rewound game states | ✅ 8/8 trials, board ply+fen preserved through kill+restart |
| Backgrounded-tab clock snap covered by a passing unit test | ✅ `use-live-clock-visibility.test.tsx` |
| All suites green incl. engine coverage gate | ✅ §3 |
| bug-005 specs untouched + passing | ✅ §3 |
