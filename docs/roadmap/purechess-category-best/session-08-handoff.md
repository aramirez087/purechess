# Session 08 Handoff — Prod Deploy + WebSocket Verify

**Epic:** purechess-category-best · **Session:** 08 · **Date:** 2026-06-11
**Mission:** Ship the hardened build to Fly.io with real WebSockets in production (prod was
degrading to polling) and prove the budgets on the live site.

---

## 0. VERDICT — **GO. Exit criteria met.**

Production live games now push over **WebSocket** between two real clients (no 1.5s polling
cadence). All smoke surfaces are green on https://purechess-web.fly.dev. Rollback path is written
down (§7). `flyctl auth whoami` = `alexramirez.cr@gmail.com` → the Task-1 auth blocker did **not**
apply; deploy tasks 2–8 all completed.

One **pre-existing, named, non-blocking residual** carries forward unchanged from S07 §5.1: the
**computer-game page Lighthouse perf < 95** (prod 80; S07 local simulate 79). This session changed
**no web source** (config-only), so it neither introduced nor could fix that bundle-split debt —
still owned by the next perf session.

---

## 1. Root cause of "prod falls back to polling" (fixed)

`apps/web/src/hooks/use-game-socket.ts` resolves:
```
WS_URL = NEXT_PUBLIC_WS_URL || NEXT_PUBLIC_API_URL || (NODE_ENV==='production'
           ? 'https://purechess-api.fly.dev' : 'http://localhost:4000')
```
The web build bakes `NEXT_PUBLIC_API_URL=''` (same-origin `/api` proxy, intentional — avoids CORS
preflight) and left `NEXT_PUBLIC_WS_URL` **unset**, so WS_URL fell through to the
`NODE_ENV==='production'` branch. That branch is fragile: it depends on Next inlining
`process.env.NODE_ENV` into the client bundle; any build that doesn't collapses WS_URL to
`http://localhost:4000` → the browser can't reach it → the socket never connects → the client stays
on its slow REST heartbeat (the "polling" symptom). WS cannot ride the `/api` rewrite because
rewrites don't HTTP-upgrade, so the browser must hit the api origin directly.

**Fix (deterministic):** bake `NEXT_PUBLIC_WS_URL=https://purechess-api.fly.dev` explicitly so
WS_URL no longer depends on the NODE_ENV branch. Logged as `bug-324`.

---

## 2. Changes committed

| File | Change |
|---|---|
| `apps/web/fly.toml` | added `NEXT_PUBLIC_WS_URL = "https://purechess-api.fly.dev"` to `[build.args]` (with rationale comment) |
| `apps/web/Dockerfile` | added `ARG NEXT_PUBLIC_WS_URL` + `ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL` in the `builder` stage (both required, or the build arg is dropped before `next build`) |

**Not changed (verified only):**
- `apps/web/next.config.mjs` — prod `connect-src` already permits `wss:` + `https://*.fly.dev`,
  and `script-src` already has `'wasm-unsafe-eval'`. **Confirmed live** (`curl -sI / | grep csp`):
  `connect-src 'self' wss: https://*.sentry.io https://*.posthog.com https://eu.posthog.com https://*.fly.dev`.
  No duplication added.
- `apps/api/fly.toml`, `apps/api/Dockerfile` — already correct (WEB_URL / NEXT_PUBLIC_APP_URL /
  NEXT_PUBLIC_API_URL + gateway CORS lists the web origin with credentials).
- `NEXT_PUBLIC_API_URL` stays `''` (same-origin proxy). Pointing it at the api origin would
  reintroduce CORS preflight on every REST call; WS is a separate channel and needs only its own
  explicit origin.

Commit: `feat(deploy): bake NEXT_PUBLIC_WS_URL for prod WebSockets`.

---

## 3. Pre-deploy gates (worktree root, after bootstrap)

Bootstrap: `pnpm install` → `pnpm --filter @purechess/shared build` →
`pnpm --filter @purechess/api db:generate`. All clean.

| Gate | Result |
|---|---|
| `cd apps/web && pnpm exec tsc --noEmit` | ✅ clean (config plumbing did not break types) |
| `pnpm build` (root, prod) | ✅ api `Done`, web `Done`; `/` 247 kB, shared-by-all 166 kB, CG 245 kB — **identical to S07** (no source change) |

Full vitest/jest suites were not re-run: this session edited zero TS source under test (only
`fly.toml` + `Dockerfile`), so suites are as S07 (web 287 pass / api 302 pass, engine gate
98.36/86.2/100). `tsc --noEmit` + prod build are the meaningful gates for a config change.

---

## 4. Deploy log

Deployed **api before web** (web's WS target + SSR fetches point at the api). Both with the
cerebrum-mandated `flyctl deploy . -c apps/<x>/fly.toml --remote-only` from repo root.

| App | Cmd | Result | Version |
|---|---|---|---|
| api | `flyctl deploy . -c apps/api/fly.toml --remote-only` | ✅ release_command (migrations) completed; rolling update; health check passing | v7 → **v8** |
| web | `flyctl deploy . -c apps/web/fly.toml --remote-only` | ✅ image built (56 MB); rolling update; health check passing | v10 → **v11** |

Boot verification:
- **api**: `GET /api/health` → `200 {"status":"ok","db":"ok","redis":"ok"}`; logs show
  `Nest application successfully started`, `Health check 'health' on port 4000 is now passing`. No
  boot errors. The single deploy WARNING ("not listening on 0.0.0.0:4000") was on the
  auto-stopped second machine (auto_stop_machines), not the live one.
- **web**: `GET /api/health` → 200; logs show `✓ Ready in 157ms`. The pre-deploy "no host
  specified" proxy errors in logs are internet bot scans (e.g. `/boaform/admin/...`), not app
  errors. Status: started machine `1 passing`; second machine auto-stopped (expected).
- **`NEXT_PUBLIC_WS_URL` baked confirmed**:
  `flyctl ssh console -a purechess-web -C "grep -rl purechess-api.fly.dev /app/apps/web/.next/static"`
  → `…/chunks/app/(play)/play/[gameId]/page-9b841628ed8b0d56.js`. The socket-hook chunk carries the
  explicit origin (it only loads on game routes, which is why the home page chunks don't reference it).
- Secrets present (`flyctl secrets list -a purechess-api`, names only): `DATABASE_URL`,
  `DATABASE_URL_DIRECT`, `REDIS_URL`, `SESSION_SECRET` — all `Deployed` (SESSION_SECRET ≥32, boot
  succeeded).

---

## 5. WebSocket proof in production (Task 4) — **PASS**

No chrome-devtools MCP was connected this session, so instead of eyeballing the network tab I ran a
**headless two-client socket.io proof** against the live origin — stronger and mutation-proof
(asserts the transport and the actual peer push, not a visual impression). Script pattern recorded
in cerebrum; reproduce with `/tmp/ws-proof.mjs`.

Flow: register 2 users (separate sessions) → user A creates a **rated blitz** friend invite (white)
→ user B accepts → both sockets join the game room → A submits `e2e4` over REST → assert B receives
the server push.

```
socket A connected transport=polling
socket A UPGRADE -> websocket
socket B connected transport=websocket          (engine.io polling→websocket upgrade, both clients)
B presence after join: {gameId, userIds:[<A>,<B>]}   (presence broadcast: both players)
A REST move e2e4 -> 200
>>> B RECEIVED game:state PUSH in 864ms over transport=websocket
    pushed fen: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1

VERDICT
  both sockets on websocket transport:               PASS
  REST move pushed to peer over WS (<3s, 864ms):     PASS
  presence broadcast received:                       PASS
```

This is the engine.io `polling → websocket` upgrade the task asks to verify; the move arrives as an
**event push** over the websocket transport (no 1.5s polling cadence), to the **api origin**
`purechess-api.fly.dev`. Cross-site auth works: the session cookie (SameSite=None;Secure) is read
off the handshake by `realtime.gateway.ts`.

> Harness note: a node client has no cookie jar, so the proof injects the session cookie via
> `extraHeaders:{Cookie}` and starts on `polling` (engine.io only applies extraHeaders on polling),
> then upgrades. A real browser auto-sends the SameSite=None cookie on the ws handshake and can go
> websocket-first. Either way the production transport ends on `websocket`.

---

## 6. Prod smoke (Task 5) — **all green**

HTTP + authenticated API smoke against https://purechess-web.fly.dev (script `/tmp/smoke.mjs`):

| Surface | Result |
|---|---|
| `/` (home) | 200; designqc render compliant (§6a) |
| `/play` | 200 |
| `/analyze` | 200 |
| `/login`, `/register` | 200 |
| `/games` (auth) | 200; `GET /api/users/:u/games` 200 |
| `/profile/:username` (auth) | 200; ratings = bullet/blitz/rapid all 1500 @ gamesPlayed 0 (Glicko default) |
| `/computer-game/:id` (auth) | 200; `POST /api/computer-games` → 201 |
| Stockfish assets | `stockfish.js` 200, `stockfish.wasm` 200, `stockfish.wasm.js` 200 (CSP `wasm-unsafe-eval` present → client engine loads) |

**Ledger delta proven end-to-end on live prod** (`/tmp/ledger.mjs`): two users played a rated blitz
game, B resigned → `result=white_wins, status=completed` → Glicko-2 ran inside the transaction:
- winner A blitz **1500 → 1662**, loser B blitz **1500 → 1338**
- A `/games` ledger grew **0 → 1** (`result=win, rated=true`)

This exercises the full live lifecycle: invite → active → REST move → resign → RatingsService
(`FOR UPDATE` tx, untouched) → Rating + RatingHistory → ledger surface.

### 6a. designqc (Task 5)
`openwolf designqc --url https://purechess-web.fly.dev` captured 6 shots (desktop+mobile) to
`.wolf/designqc-captures/`. Home renders **design.md-compliant**: brass-dotted "Silent Tournament"
badge, Fraunces display headline with italic "the product." + brass underline, mineral/bone board
silhouette, single brass accent on dark surface; hero headline + subtitle paint immediately (S07
LCP fix holds in prod). Matches the S07-approved look; no drift (config-only session).

---

## 7. Prod Lighthouse vs budgets.md (Task 6)

Run against the **live origin** (real network, default simulate method) — the reliable way to read
the perf number (S07 §5.4: simulate is an artifact on localhost; on a real origin it's meaningful).
budgets.md floor: perf ≥95, a11y ≥95; LCP ≤2.5s.

| URL | Perf | A11y | LCP | FCP | TBT | CLS | vs S07 local |
|---|---|---|---|---|---|---|---|
| `/` | **97** ✅ | **95** ✅ | **2.2 s** ✅ | 1.5 s | 10 ms | 0.001 | perf 99 (−2, within ±5) |
| `/computer-game/[id]` | **80** ❌ | **100** ✅ | 4.8 s | 1.5 s | 30 ms | 0 | simulate 79 (+1) / devtools 72 |

- `/` **passes both gates** on the live site (perf 97, a11y 95, LCP 2.2s). −2 vs S07 local-devtools
  99 is within the budgets.md ±5pt network-variance tolerance.
- Computer-game perf **80 < 95**: the **same named CG bundle-split debt from S07 §5.1** (route JS
  ~376 kB incl. Stockfish + chess.js + Sentry-core; client-render→fetch waterfall). Prod 80 is
  within +1 of S07 simulate (79) — **no regression**; a11y is 100, CLS 0, FCP 1.5s. Owner: next
  perf session. Levers (unchanged from S07 §5.1): Sentry-core lazy-init via
  `instrumentation-client.ts`, dynamic-import chess.js/Stockfish off the CG first load, consider
  SSR-ing board state. No >5pt regression to flag elsewhere.

---

## 8. Neon cold-start (Task 7) — measured warm; cold documented as unreproducible

The keepalive added in S02 (`apps/api/src/database/prisma.service.ts`: `SELECT 1` every 4 min,
`unref()`'d, started in `onModuleInit`) **defeats Neon autosuspend by design**. Combined with
`min_machines_running=1`, the compute stays warm, so a true cold-wake **cannot be reproduced in
prod without disabling the keepalive** — which would mean editing source + redeploying and would
regress the S02 hardening (out of scope for a deploy-verify session).

Warm path measured live instead (`client → iad → Neon us-east-2 → client`, includes home↔iad RTT):
- warm **first**-move REST round-trip: **~503 ms**
- steady-state second move: **~447 ms**

No cold penalty observed (expected — compute warm). The one-off ~0.5–2s wake noted in S07 only
applies if the keepalive is ever removed.

---

## 9. Rollback (write-down) — **verified against installed flyctl**

This flyctl build has **no `flyctl releases rollback` subcommand** (confirmed via
`flyctl releases --help`). Roll back by redeploying the prior image:

```bash
# Inspect versions + image refs:
flyctl releases -a purechess-web  --image
flyctl releases -a purechess-api  --image

# Prior stable images captured this session (before S08 deploy):
#   web v10 (stable): registry.fly.io/purechess-web:deployment-01KTT10PWFWM2PQ9XQYZDSSC8W
#   api v7  (stable): registry.fly.io/purechess-api:deployment-01KTSYT6CWPC64VCKHPGGK3GNZ

# Revert web (e.g. if WS change misbehaves):
flyctl deploy --image registry.fly.io/purechess-web:deployment-01KTT10PWFWM2PQ9XQYZDSSC8W \
  -c apps/web/fly.toml -a purechess-web --remote-only

# Revert api:
flyctl deploy --image registry.fly.io/purechess-api:deployment-01KTSYT6CWPC64VCKHPGGK3GNZ \
  -c apps/api/fly.toml -a purechess-api --remote-only
```
`min_machines_running=1` keeps a warm machine; rollback is an image/config revert, not a destroy.
Note: S08's only web change is the `NEXT_PUBLIC_WS_URL` build arg — reverting web alone restores
the pre-S08 (NODE_ENV-fallback) WS behavior; the api deploy was a no-config-change image refresh.

---

## 10. Post-deploy state (current)

- web: **v11** live (image `deployment-01KTVG2NBSPD1RDZDM5X3EXFQ6`), health passing.
- api: **v8** live (image `deployment-01KTVFPNXRMEVXWEYX7RBEJY91`), health passing, db+redis ok.
- Prod WS: verified push between two clients over websocket transport.

---

## 11. Inputs for dependent / next sessions (file paths, not memory)

1. **CG-perf-95 (the one open gate)** — owner: next perf session. Files:
   `apps/web/next.config.mjs` (Sentry/`instrumentationHook` already set),
   `apps/web/sentry.client.config.ts`, new `apps/web/src/instrumentation-client.ts` (Sentry-core
   lazy-init, −53.8 kB shared-by-all per S04), and the computer-game + `apps/web/src/app/analyze`
   routes (dynamic-import chess.js/Stockfish off first load). Even Sentry-lazy alone will not reach
   LCP ≤2.5s on CG — the bundle split is required. Prod baseline to beat: **perf 80, LCP 4.8s**
   (simulate, live origin); a11y already 100.
2. **e2e harness gaps (S07 §5.2)** — still open, owner: e2e-hardening session. 4 specs need
   TestingService move-seeding / full-flow fixtures (`game-review`, `rated-finalization`,
   `friend-invite`, `admin-disable`). Run e2e with
   `pnpm exec playwright test --config e2e/playwright.config.ts` (the bare `pnpm e2e` script
   mis-globs vitest files — candidate one-line script fix).
3. **WS prod proof harness** — `/tmp/ws-proof.mjs` pattern (transient; recreate from cerebrum
   "S08 prod WS deploy" entry). Reuse to re-verify WS after any future web/api deploy.
4. **Domain flip** — when purechess.com lands, flip `WEB_URL`/`NEXT_PUBLIC_APP_URL` (api fly.toml),
   `NEXT_PUBLIC_SITE_URL` + `NEXT_PUBLIC_WS_URL` (web fly.toml build args), and gateway CORS.
5. **Rollback refs** — §9 (web v10 / api v7 image deployment IDs).

---

## 12. Exit criteria scorecard

| Criterion | Status |
|---|---|
| `flyctl auth whoami` authenticated (no Task-1 blocker) | ✅ alexramirez.cr@gmail.com |
| `NEXT_PUBLIC_WS_URL` baked (fly.toml + Dockerfile) | ✅ §2, verified in built chunk §4 |
| CSP prod allows wss: + *.fly.dev + wasm-unsafe-eval | ✅ verified live, not duplicated |
| api then web deployed (cerebrum commands) | ✅ api v8, web v11; health green |
| Prod game shows WS push (no 1.5s polling) between 2 clients | ✅ §5 (push 864ms over websocket) |
| All smoke surfaces green on prod | ✅ §6 (incl. live ledger delta + Glicko-2) |
| Prod Lighthouse recorded vs budgets | ✅ `/` 97/95 pass; CG 80 (named S07 debt, +1 not −) |
| Neon cold-start measured/documented | ✅ §8 (warm ~503ms; cold unreproducible w/ keepalive) |
| `cd apps/web && pnpm exec tsc --noEmit` clean; root build clean | ✅ §3 |
| Rollback path written down | ✅ §9 (verified vs installed flyctl) |
| cerebrum + buglog updated | ✅ cerebrum "S08 prod WS deploy"; buglog `bug-324` |
