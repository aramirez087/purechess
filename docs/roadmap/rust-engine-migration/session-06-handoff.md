# Session 06 Handoff — Production Cutover (WP6)

**Epic:** `rust-engine-migration` · **Work package:** WP6 (cutover)
**Branch:** `epic/rust-engine-migration--s06-cutover` → `epic/rust-engine-migration`
**Status (code-side):** ✅ complete — code changes, runbook, and quality gates done in this session.
**Status (deploy-side):** ⏳ READY TO CUT OVER — operator action required. This session did **not** perform the `fly deploy` or the 48h observation window.

> **What this session did:** the in-scope code/config/runbook changes, all reproducible on a developer machine. See §1.
>
> **What this session did not do:** the production `fly deploy`, the 48h Sentry/metrics watch, and the final GO/NO-GO verdict. See §3.

---

## 1. What was done in this session

### 1.1 Code changes

| Path | Change |
|---|---|
| `apps/api/src/config/engine-backend.config.ts` | `getEngineBackend()` now returns `null` (instead of `'ts'`) when neither `ENGINE_BACKEND` nor `ENGINE_SHADOW` is explicitly set. Callers apply the environment-aware default. |
| `apps/api/src/chess/chess.module.ts` | `ENGINE_BACKEND` token now provided via `getEngineBackend()`. The `ENGINE_ADAPTER` factory applies a prod-default fallback (`'native'` in production, `'ts'` otherwise) and emits a Sentry breadcrumb `engine booted: <adapter.name()>` after construction (wrapped in `try/catch` so dev/test don't break when Sentry is uninitialized). |
| `apps/api/fly.toml` | Added `ENGINE_BACKEND = "native"` under `[env]`. This is the source of truth for production. `fly secrets` is reserved for the rollback override. |
| `apps/api/src/types/purechess-engine-native.d.ts` | **Created.** Ambient module declaration for `@purechess/engine-native`. Resolves a pre-existing WP3 packaging gap (the package's `types` field points to `dist/index.d.ts` which doesn't exist) and unblocks `pnpm -r typecheck`. The shapes mirror the call sites in `native-adapter.ts`. |

### 1.2 Documentation

| Path | Change |
|---|---|
| `docs/runbooks/engine-cutover.md` | **Created.** Full cutover + rollback runbook. Pre-cutover checklist, staging deploy, prod cutover, monitoring dashboard links, rollback thresholds, rollback command, post-rollback procedure. See `docs/runbooks/engine-cutover.md` for the full content. |
| `docs/roadmap/rust-engine-migration/session-06-handoff.md` | **Created (this file).** |

### 1.3 CI verification

`engine-shadow` and `rust-parity` jobs in `.github/workflows/ci.yml` already run on `push: branches: [main]` (the top-level `on:` block at line 7 includes main, and the jobs have no path filter). No workflow change was needed.

### 1.4 Quality gates (run in this session, all green)

```bash
pnpm -r typecheck            # ✅ clean
pnpm -r lint                 # ✅ clean (only pre-existing Sentry/webpack deprecation warnings)
pnpm engine:shadow           # ✅ 203 traces, 0 divergences (ts-vs-ts in CI mode)
pnpm test                    # ✅ 246 api + 190 web tests passing
```

Pre-existing typecheck errors in `apps/api/src/chess/engine/native-adapter.ts` (missing types for `@purechess/engine-native`) were blocking the typecheck gate; fixed in §1.1 by adding the ambient declaration file.

---

## 2. Key design decisions

### 2.1 `getEngineBackend()` returns `null` when unset

Belt-and-suspenders. `fly.toml` sets `ENGINE_BACKEND=native` for prod, so in practice `getEngineBackend()` returns `'native'` without hitting the null path. But if a deploy accidentally drops the env var (fly.toml merge conflict, manual `fly secrets unset`), the production fallback in the factory ensures we stay on native. The `'ts'` default remains for local dev where `NODE_ENV !== 'production'`.

### 2.2 `chess.module.ts` is the right place for the prod-default + breadcrumb

`engine/index.ts:32` (the singleton `engine` for scripts) already has a `!_nativeAvailable` fallback. The NestJS DI factory in `chess.module.ts` is the production code path; that's where the prod-default belongs.

### 2.3 `fly.toml` is the source of truth for prod

Putting `ENGINE_BACKEND = "native"` under `[env]` (not `fly secrets`) makes the value visible in PR review, reproducible across deploys, and easy to roll back (just `fly secrets set ENGINE_BACKEND=ts` overrides it). `fly secrets` takes precedence over `fly.toml [env]`, so the rollback path is one env var + redeploy (~90s).

### 2.4 Sentry breadcrumb wrapped in `try/catch`

Sentry is not initialized in dev/test environments. The breadcrumb add is wrapped so that the factory does not throw when Sentry is absent. The catch is intentionally a no-op silent — there's nothing useful to do with that error.

### 2.5 Engine native type shim (WP3 debt)

The `packages/engine-native/package.json` has `"types": "dist/index.d.ts"` but the package ships `index.js` (a napi-rs binding) with no compiled types. The proper fix is in WP3: add a `tsc --build` step that emits types to `dist/`. The ambient shim in this session is a stopgap that unblocks WP6's typecheck gate. The shim is structurally a subset of what the napi-rs-generated `.d.ts` will eventually look like, so removing it after the WP3 fix is a one-file delete.

---

## 3. Operator action required — cutover checklist

The following is the procedure for the human on-call. **Do not delegate this to a model session** — it requires Fly.io auth, Sentry access, and on-call judgment.

### 3.1 Pre-cutover (T-24h)

- [ ] Confirm the WP6 PR is merged into `epic/rust-engine-migration` and CI is green.
- [ ] Staging app exists (`fly apps list | grep purechess-api-staging`). If not, create per `docs/runbooks/engine-cutover.md` §5.
- [ ] Staging has separate `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET` secrets (do not point staging at prod DB).
- [ ] Deploy staging: `fly deploy -a purechess-api-staging`.
- [ ] Smoke: `curl -sf https://purechess-api-staging.fly.dev/api/health` → `{"status":"ok"}`.
- [ ] Confirm Sentry breadcrumb `engine booted: native` on staging boot.
- [ ] **Test rollback on staging** (do not skip): `fly secrets set ENGINE_BACKEND=ts -a purechess-api-staging` → `fly deploy` → confirm breadcrumb `engine booted: ts` → `fly secrets unset ENGINE_BACKEND` → back to native.
- [ ] Play one complete game on staging.
- [ ] Watch staging for 24h. No `engine.shadow.divergence` events. No Sentry errors with `engine.adapter=native`.

### 3.2 Cutover (T-0)

- [ ] Confirm on-call is staffed for the next 48h.
- [ ] `git log -1 --oneline` on `epic/rust-engine-migration` matches the WP6 merge commit.
- [ ] `fly deploy -a purechess-api` (picks up `fly.toml` `ENGINE_BACKEND=native`).
- [ ] `fly checks list -a purechess-api` shows the health check recovering.
- [ ] `curl -sf https://purechess-api.fly.dev/api/health` → `{"status":"ok"}`.
- [ ] **Verify Sentry breadcrumb** `engine booted: native` in the Sentry stream (most recent boot event of `purechess-api`).
- [ ] If breadcrumb shows `ts`: native binary is missing from the image. Roll back per §3.4 and investigate the Dockerfile's `COPY --from=rust-builder` step.

### 3.3 48h observation window

- [ ] Sentry: error rate on `validateMove` < 0.5% sustained 5 min.
- [ ] Sentry: zero `engine.shadow.divergence` events (shadow is off in prod).
- [ ] Sentry breadcrumbs: every boot of `purechess-api` shows `engine booted: native`.
- [ ] Metrics: p99 `validateMove` < 50ms (expect < 5ms; was ~2ms in shadow testing).
- [ ] DB: rolling 1h game completion rate within ±5% of the pre-cutover baseline.
- [ ] No SEV-1 game-state bug reports from players.

### 3.4 Rollback (any of §3.3 thresholds breached)

```bash
fly secrets set ENGINE_BACKEND=ts -a purechess-api
fly deploy -a purechess-api
# Verify Sentry breadcrumb flips to "engine booted: ts"
```

`.node` binary stays in the image; rollback is one env var + redeploy (~90s). Do not remove the `ENGINE_BACKEND = "native"` line from `fly.toml` — `fly secrets` is the override layer. To clear the override after the incident:

```bash
fly secrets unset ENGINE_BACKEND -a purechess-api
fly deploy -a purechess-api
```

---

## 4. Go / No-Go verdict (fill in after the 48h window)

**Cutover timestamp:** _____________________

| Metric | Pre-cutover (TS) | Post-cutover (Native) | Δ | Threshold | Pass? |
|---|---|---|---|---|---|
| p50 `validateMove` (ms) | _______ | _______ | _______ | < 5ms | ☐ |
| p99 `validateMove` (ms) | _______ | _______ | _______ | < 50ms | ☐ |
| `engineErrors` rate (5min rolling) | _______ | _______ | _______ | < 0.5% | ☐ |
| `engine.shadow.divergence` count | n/a | _______ | _______ | 0 | ☐ |
| Game completion rate (1h rolling) | _______ | _______ | _______ | ±5% | ☐ |
| Sentry boot breadcrumbs (sample of 10) | n/a | all `native`? | n/a | 10/10 | ☐ |
| SEV-1 game-state bugs | 0 | _______ | _______ | 0 | ☐ |

**Verdict:** ☐ **GO** — proceed to WP7 (cleanup). ☐ **NO-GO** — schedule WP6.5 (rollback investigation).

**Notes / anomalies:**

_______________________________________________________
_______________________________________________________
_______________________________________________________

---

## 5. Files in this session's commit (planned)

```
docs/runbooks/engine-cutover.md
docs/roadmap/rust-engine-migration/session-06-handoff.md
apps/api/src/config/engine-backend.config.ts
apps/api/src/chess/chess.module.ts
apps/api/fly.toml
apps/api/src/types/purechess-engine-native.d.ts
```

---

## 6. Open follow-ups (out of scope for WP6)

1. **WP3 debt — `engine-native` package types.** The proper fix is a `tsc --build` step in `packages/engine-native` that emits `dist/index.d.ts`. The ambient shim in this session is a stopgap; remove it after the real fix lands.
2. **WP7 — cleanup.** Remove TS adapter fallback, deprecated env-var names, and the `ENGINE_SHADOW` path. (Scheduled separately.)
3. **Alerting.** Add a Sentry alert on `engine.shadow.divergence` (zero target). Document the alert in `docs/runbooks/observability.md`.
4. **Native binary build pipeline.** Confirm the multi-stage Dockerfile (`apps/api/Dockerfile`) correctly copies the compiled `.node` binary into the runtime image. WP3 should have done this; verify before staging deploy (s05 handoff §3 also flagged this).
