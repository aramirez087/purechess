# Engine Cutover Runbook

**Owner:** on-call
**Last reviewed:** 2026-06-08 (Session 6, WP6)
**Trigger:** production cutover of `ENGINE_BACKEND=native` for the chess engine adapter.

This runbook is read top-to-bottom the first time, then used as a checklist at
cutover. It assumes the work in WP1–WP5 is merged: native `.node` binary built,
TS and Native adapters parity-tested with 0 divergences over 200+ traces, and
shadow mode exercised in staging.

---

## 1. Pre-cutover checklist

All of the following must be true within 24 hours of the cutover. **If any item
is unchecked, do not cut over.**

- [ ] `pnpm engine:shadow` exits 0 on the latest commit of `epic/rust-engine-migration` (203 traces, 0 divergences).
- [ ] `cargo test --features impl` is green in `crates/purechess-engine` (Rust parity + perft).
- [ ] CI is green on the cutover PR (`lint-typecheck`, `test`, `build`, `engine-shadow`, `rust-parity`).
- [ ] Staging has been running on `ENGINE_BACKEND=native` for ≥ 24 hours with no `engine.shadow.divergence` events in Sentry.
- [ ] A staging smoke (health check + one complete game) was performed and the Sentry breadcrumb `engine booted: native` is visible.
- [ ] The rollback command has been **tested** on staging (see §4) within the last 7 days. Do not skip this.
- [ ] An on-call engineer is scheduled and available for the next 48 hours.
- [ ] The deploy communicator (Slack/Discord) is staffed so rollback decisions can be made quickly.
- [ ] `apps/api/fly.toml` contains `ENGINE_BACKEND = "native"` under `[env]`. Verify with:

  ```bash
  grep -A1 '^\[env\]' apps/api/fly.toml
  ```

- [ ] The native `.node` binary is present in the deployed Docker image (Sentry breadcrumb will reveal this at boot — see §3.3).

---

## 2. Cutover steps (production)

The cutover is a single `fly deploy`. The `ENGINE_BACKEND=native` env var is in
`fly.toml`, so it is PR-reviewable and reproducible.

```bash
# 1. Confirm we're on the right branch
git rev-parse --abbrev-ref HEAD   # should be epic/rust-engine-migration
git log -1 --oneline

# 2. Deploy to production
fly deploy -a purechess-api

# 3. Wait for the health check to flip back to "ok" (max ~30s)
fly checks list -a purechess-api

# 4. Smoke the API directly
curl -sf https://purechess-api.fly.dev/api/health
# Expected: {"status":"ok",...}

# 5. Confirm the Sentry breadcrumb fired (see §3.3)
```

**Do not run `fly secrets set ENGINE_BACKEND=native`.** Putting it in `fly.toml`
makes the value visible in PR review and reproducible across deploys. `fly
secrets` is reserved for the rollback override (§4).

---

## 3. Monitoring during the 48h observation window

### 3.1 Dashboards

- **Sentry** — filter by `engine.adapter=native`. Watch:
  - Error rate on `validateMove`, `legalMoves`, `detectResult`, `applyMoves`, `legalMovesAfter`.
  - Tagged events: `engine.method=<method>`, `engine.error=<class>`.
- **Sentry breadcrumbs** — confirm the boot breadcrumb is present:
  - `engine booted: native` (healthy cutover)
  - `engine booted: ts` (rollback or native binary absent — investigate immediately)
  - `engine booted: shadow-ts` (shadow mode is active — should not be in prod)
- **Sentry custom metric** — `engine.shadow.divergence` (target: 0 events; should
  be 0 in prod because shadow mode is not active).
- **Internal metrics endpoint** — `GET /api/metrics` (or whatever the app
  exposes; verify path on first deploy). Counters of interest:
  - `moveValidations` (counter; expect same throughput as pre-cutover)
  - `engineErrors` (counter; expect 0)
  - `validateMoveLatency` (histogram; expect p99 < 5ms vs. ~2ms in shadow testing)
- **Game completion rate** — `SELECT count(*) FROM "Game" WHERE status='completed'
  AND "updatedAt" > now() - interval '1 hour'` over the same window pre- and
  post-cutover. A drop > 5% is a signal.

### 3.2 What "healthy" looks like

| Metric | Pre-cutover (TS) | Post-cutover (Native) | Rollback threshold |
|---|---|---|---|
| p50 `validateMove` | ~0.5ms | ~0.2ms (expect) | n/a |
| p99 `validateMove` | ~2ms | < 5ms | **> 50ms sustained 5min** |
| `engineErrors` | 0 | 0 | **> 0.5% sustained 5min** |
| `engine.shadow.divergence` | n/a (no shadow) | n/a | **any** |
| Game completion rate (1h rolling) | baseline | within ±5% | **drop > 5% sustained 30min** |

### 3.3 How to confirm the cutover actually took effect

Three independent signals must agree:

1. **Sentry breadcrumb** on app boot: `engine booted: native`. This is the
   cheapest, fastest check. Search Sentry for the most recent boot event of
   `purechess-api` and look for the breadcrumb in the "Breadcrumbs" tab.
2. **Fly env**:
   ```bash
   fly config -a purechess-api | grep ENGINE_BACKEND
   # or
   fly ssh console -a purechess-api -C "printenv | grep ENGINE"
   ```
3. **Process log** at boot (if logs are retained):
   ```
   [engine] engine booted: native
   ```
   The line is emitted by the Sentry breadcrumb path; the actual logger write is
   on the `EngineService` boot path. If the breadcrumb fires but the log line
   does not, that's a logging bug, not an engine bug.

If any of the three shows `ts` instead of `native` immediately after deploy, the
binary is absent from the image. Roll back (see §4) and investigate the
Dockerfile's `COPY --from=rust-builder` step.

---

## 4. Rollback

The `.node` binary stays in the image after the cutover deploy, so rollback is
one env var change + redeploy (≈ 90s end-to-end).

### 4.1 Rollback command

```bash
# Override via fly secrets (takes precedence over fly.toml [env])
fly secrets set ENGINE_BACKEND=ts -a purechess-api
fly deploy -a purechess-api

# Verify the breadcrumb flipped
# Sentry: "engine booted: ts"
curl -sf https://purechess-api.fly.dev/api/health
```

Do **not** remove the `ENGINE_BACKEND = "native"` line from `fly.toml`. The line
in `fly.toml` is the *forward* default; the `fly secrets` value is the
*incident* override. When the incident is over, unset the secret:

```bash
fly secrets unset ENGINE_BACKEND -a purechess-api
# ENGINE_BACKEND returns to fly.toml's "native" on the next deploy
```

### 4.2 Rollback thresholds — ANY of these triggers immediate rollback

| Trigger | Detection | Action |
|---|---|---|
| Any FEN divergence between engine output and expected board state in a live game | Sentry event tagged `engine.shadow.divergence` (if shadow is running) or a player report with a verifiable FEN mismatch | Roll back, file SEV-1 |
| `engineErrors` rate > 0.5% sustained for 5 minutes | Sentry alerts on `engine.error.*` | Roll back |
| p99 `validateMove` > 50ms for 5 minutes | Metrics dashboard | Roll back |
| A single SEV-1 game-state bug (wrong legal moves, illegal move accepted, wrong result detected) | Player report + reproduction | Roll back |
| Game completion rate drops > 5% sustained 30 minutes | DB query (§3.1) | Investigate first; rollback if not a traffic/DB issue |

### 4.3 Post-rollback

1. File an incident note in the deploy channel.
2. Do not re-attempt cutover until the root cause is identified and a regression
   test is added to `parity.rs` and `parity.spec.ts`.
3. If the cause is a native-binary bug, file under the Rust crate and treat it
   as a hot-fix to that crate before re-attempting.

---

## 5. Staging deploy (run once, 24h observation, then cut over prod)

```bash
# Confirm or create the staging app
fly apps list | grep purechess-api-staging
# If absent:
fly apps create purechess-api-staging
# Configure separate DB + Redis + SESSION_SECRET secrets
fly secrets set DATABASE_URL=... -a purechess-api-staging
fly secrets set REDIS_URL=... -a purechess-api-staging
fly secrets set SESSION_SECRET=... -a purechess-api-staging

# Deploy
fly deploy -a purechess-api-staging

# Smoke
curl -sf https://purechess-api-staging.fly.dev/api/health
# Verify Sentry breadcrumb: "engine booted: native"

# Test rollback on staging first (do not skip this)
fly secrets set ENGINE_BACKEND=ts -a purechess-api-staging
fly deploy -a purechess-api-staging
curl -sf https://purechess-api-staging.fly.dev/api/health
# Verify breadcrumb: "engine booted: ts"
fly secrets unset ENGINE_BACKEND -a purechess-api-staging
fly deploy -a purechess-api-staging
# Back to native
```

Run the staging app on `ENGINE_BACKEND=native` for 24h with no shadow mode
before cutting over prod. Staging has no user traffic; a 24h soak is enough to
catch boot-time issues and adapter init problems.

---

## 6. References

- `docs/roadmap/rust-engine-migration/session-05-handoff.md` — shadow-mode results, divergence count, Sentry metric names
- `docs/roadmap/rust-engine-migration/session-06-handoff.md` — actual cutover metrics, before/after comparison, go/no-go verdict
- `apps/api/src/chess/chess.module.ts` — DI factory that picks native/ts
- `apps/api/src/config/engine-backend.config.ts` — env-var reader
- `apps/api/fly.toml` — `[env]` block source of truth for prod
- `.github/workflows/ci.yml` — `engine-shadow` and `rust-parity` CI jobs
