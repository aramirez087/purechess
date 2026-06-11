# Session 01 Handoff — Charter + Baselines

**Epic:** purechess-category-best · **Date:** 2026-06-10 · **Mode:** read-only measurement + docs.
**Source changes:** NONE (only `docs/roadmap/purechess-category-best/*` + `.wolf/*`).

---

## 1. What was done

1. **Bootstrapped the fresh worktree:** `pnpm install` → `pnpm --filter @purechess/shared build`
   → `pnpm --filter @purechess/api db:generate`. Postgres + Redis already up in Docker
   (`purechess-postgres-1`, `purechess-redis-1`) — no `infra:up` needed.
2. **Recorded ports:** `:3000` and `:4000` were occupied by other checkouts. Used **PORT=3100**
   for the prod web server (`pnpm start`) for Lighthouse. No API server needed this session.
3. **Measured baselines** (bundle, Lighthouse, latency paths, reliability config) — see §2.
4. **Wrote the charter:** `budgets.md` (numeric budgets for all 6 routes + reconnect + latency)
   and `ownership.md` (single-writer file map for sessions 02–06).
5. **Audited downstream session plans** — they are **absent** (see §4, Open issue 1). No
   `.epic-produces-overrides.json` written (nothing to override). Documented the absence.
6. **Updated** `.wolf/cerebrum.md`, `.wolf/memory.md`, `.wolf/anatomy.md`.

---

## 2. Baseline measurements (with exact reproduction commands)

### 2.1 Bundle — First Load JS
```bash
cd apps/web && pnpm build   # no ANALYZE flag exists; read "First Load JS" from the route table
```
| Route | First Load JS |
|---|---|
| `/` | 348 kB |
| `/play` | 304 kB |
| `/games` | 294 kB |
| `/analyze` | 356 kB |
| `/play/[gameId]` | 297 kB |
| `/computer-game/[gameId]` | 283 kB |
| shared-by-all | **204 kB** (caps every route) |

### 2.2 Lighthouse (prod mode)
```bash
cd apps/web && PORT=3100 pnpm start   # prod build already produced by 2.1
npx --yes lighthouse http://localhost:3100/ --chrome-flags="--headless=new" \
  --only-categories=performance,accessibility --output=json
```
| URL | Perf | A11y | LCP | TBT | CLS | FCP / SI |
|---|---|---|---|---|---|---|
| `/` | 78 | 95 | 6.3 s | 20 ms | 0 | 1.1 s / 1.3 s |
| `/play` (board proxy) | 78 | 100 | 6.0 s | 10 ms | 0 | — |
| `/computer-game/[gameId]` | **NO_FCP** | — | — | — | — | — |

The computer-game route paints nothing for an unseeded/unauthenticated id (`NO_FCP`). Capture
it later by seeding a game and passing the session cookie — command is in `budgets.md` §2.

### 2.3 Move latency (read-only, no instrumentation)
From `apps/web/src/app/(play)/play/[gameId]/live-game-client.tsx`:
- **input → optimistic render:** local `chess.js` move + synchronous `setState` (L405-433),
  no network → ~1 ms (next React commit).
- **server push → render:** `useGameSocket.onState` → `isStaleState` guard → `setState`
  (L261-274) → **~11 ms** (LAN, `.wolf/memory.md`); ≈ RTT in prod.
- **move POST round-trip:** `submitPvpMove` awaits authoritative state, reconciles/rolls back
  (L434-448).

### 2.4 Reliability config (read-only)
- `use-game-socket.ts`: `io(WS_URL, { withCredentials, transports:['websocket','polling'] })` —
  **no explicit reconnection options** → socket.io defaults (reconnectionDelay 1000 ms jittered,
  attempts Infinity, timeout 20000 ms). `connect` re-emits `GameJoin` + calls `onResync()`
  (guarded REST refetch).
- `realtime.gateway.ts`: `@WebSocketGateway` with **no ping options** → defaults
  pingInterval 25000 ms / pingTimeout 20000 ms → server dead-peer detection up to **~45 s**.
- Neon autosuspend cold-wake **0.5–2 s** (`.wolf/cerebrum.md`) threatens the < 2 s resync
  budget when the resync REST hits a cold DB.

---

## 3. Decisions made (with why)

1. **Budgets are baseline-anchored, never aspirational-above-measured.** Each route gets a
   **hard ceiling = today's baseline** (no-regression gate) and a **target** below it (ratchet);
   the gap is tracked debt. Rationale: the operator rules forbid setting a budget above what is
   measured; this keeps budgets enforceable and honest.
2. **Dropped the plan's 180 kB static-route ceiling — it is infeasible.** It sits below the
   204 kB shared-bundle floor. Targets are set relative to that floor (static ≤ 240, board ≤ 250),
   and **shrinking shared (≤ 175 kB) is called out as the highest-leverage debt** since it pays
   down every route. This is the main correction vs the plan's §2.2 starting ceilings.
3. **Performance debt is entirely LCP.** Perf 78 vs the 95 floor is driven by LCP ~6 s; TBT/CLS
   are already excellent. The perf-owning session should chase LCP ≤ 2.5 s, not micro-optimise JS.
4. **Accessibility floor is already met (95–100).** Budget = hold, not chase.
5. **Computer-game Lighthouse left "to capture", not fabricated.** The route needs a seeded game +
   auth; recording invented numbers would violate the no-fabrication rule. `/play` stands as the
   reachable interactive-board proxy.
6. **Ownership map is best-effort** (session files absent) and explicitly labelled as such, with a
   reconciliation step (§5 of `ownership.md`) for when the real frontmatter appears.

---

## 4. Open issues

1. **Downstream session files (02–06) are ABSENT.** `docs/claude-sessions/purechess-category-best/`
   does not exist in this worktree. Tasks 4 & 5 assume readable `touches`/`produces` frontmatter.
   Consequences:
   - `ownership.md` is derived from operator-rules hardening surfaces + Tier D backlog, not from
     real frontmatter. **Reconcile when the files appear** (`ownership.md` §5).
   - **No `.epic-produces-overrides.json` was written** — there is nothing to override without the
     real `produces` lists. Do NOT create one blind; create it only against real session files.
2. **Perf debt:** every route's First Load JS exceeds its target; LCP ~6 s on every route. Largest
   offenders: `/analyze` (356 kB) and `/` (348 kB). The 204 kB shared floor is the root lever.
3. **Reliability gaps:** server dead-peer detection ~45 s (socket.io default ping); no explicit
   client reconnect tuning; cold-Neon can blow the < 2 s resync budget.
4. **Computer-game Lighthouse uncaptured** (NO_FCP) — needs a seeded+authed run.

---

## 5. Explicit inputs for dependent sessions (file paths, not memory)

- **All sessions:** read `docs/roadmap/purechess-category-best/budgets.md` (the budget contract)
  and `docs/roadmap/purechess-category-best/ownership.md` (your owned files + overlap workarounds)
  before touching anything.
- **Bundle/perf session (proposed S02):** targets in `budgets.md` §1+§2. Start with the 204 kB
  shared floor (`apps/web` Sentry/PostHog init, `apps/web/next.config.mjs`) and the LCP path on
  `/` and `/analyze`. Re-measure with `cd apps/web && pnpm build` and the Lighthouse command in
  `budgets.md` §2.
- **Reliability session (proposed S03):** `apps/web/src/hooks/use-game-socket.ts` (reconnect
  tuning), `apps/api/src/realtime/realtime.gateway.ts` (add `pingInterval`/`pingTimeout`). Budget:
  reconnect→resync < 2 s; dead-peer detection in seconds. Preserve `isStaleState` + graceful
  degradation.
- **Engine session (proposed S04):** `apps/api/src/chess/engine/**`; keep coverage gate green; do
  not weaken `apps/api/test/games/games.service.spec.ts` bug-005 flag-fall specs.
- **Ratings session (proposed S05):** `apps/api/src/ratings/**` + `games.service.ts` persistence;
  keep FOR UPDATE tx; new DTO fields optional in `packages/shared` + rebuild. Surface
  `ratingDelta` in the `/games` ledger (Tier A backlog item).
- **A11y/polish session (proposed S06):** hold a11y ≥ 95; new CSS in `globals.css @layer
  utilities` (not `tailwind.config.ts`); obey design.md.
- **Reconciliation owner (whoever runs next with session files present):** follow `ownership.md`
  §5 — diff real `touches` globs against the map, resolve new overlaps, write overrides if any
  `produces` is already satisfied.

---

## 6. Quality gates (this session)

| Gate | Result |
|---|---|
| `cd apps/api && pnpm exec tsc --noEmit` | ✅ clean (exit 0, after `db:generate`) |
| `cd apps/web && pnpm exec tsc --noEmit` | ✅ **clean** (exit 0) — the cerebrum-predicted red (lucide `Github`/`Twitter`, admin-table children) is already fixed upstream |
| Source/test changes | none — no test suites required by DoD |

Exit criteria met: budgets.md has a numeric budget for all 6 routes + reconnect (< 2 s) + latency;
ownership.md covers the hardening surfaces with zero unresolved overlaps (best-effort, session
files absent — flagged); baselines recorded with exact commands.
