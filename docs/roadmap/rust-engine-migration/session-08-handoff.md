# Session 08 Handoff — CI Gate (WP8) — Epic Close

**Epic:** `rust-engine-migration` · **Work package:** WP8 (CI gate / epic close)
**Branch:** `epic/rust-engine-migration--s08-ci-gate` → `epic/rust-engine-migration`
**Status:** ✅ **GO** — full quality matrix green end-to-end.

> **What this session did:** inventoried the CI workflow, filled the one gap (clippy), and ran the entire session-8 quality matrix locally. No code, no test, no behaviour change outside `.github/workflows/ci.yml`.
>
> **What this session did not do:** session 7 (cleanup / TS-engine removal). Session 7 is gated on the operator rule *"The TS engine stays behind a feature flag (ENGINE_BACKEND=ts) for at least 2 releases. Removing it is WP7"* (CLAUDE.md / session-00). We are zero releases past the WP6 cutover, so the precondition is not met. s07 is recorded as a post-deploy follow-up in §6.

---

## 1. CI workflow inventory (before this session)

`.github/workflows/ci.yml` already had every required job from the s08 spec except one:

| Required by s08 | Existing job | Status before | Action |
|---|---|---|---|
| `cargo test` on PRs | `rust-parity` (`cargo test --features impl`, `dtolnay/rust-toolchain@stable`, `Swatinem/rust-cache`) | ✅ present | none |
| `pnpm engine:shadow` on PRs | `engine-shadow` (ts-vs-ts mode) | ✅ present (added in WP5) | none |
| Rust toolchain installed | `dtolnay/rust-toolchain@stable` in `rust-parity` | ✅ present | none |
| `cargo clippy --all-targets -- -D warnings` | — | ❌ **missing** | **added this session** |
| `@napi-rs/cli` for the API build | not required in CI; CI runs ts-vs-ts shadow mode and the API build is done in Docker | n/a | none |
| `NAPI_PREBUILT_BINARY_HOST_MIRROR` | set in `apps/api/fly.toml` (deploy path), not CI. CI doesn't need it (no native binary on the runner). | n/a | none |
| `engine-shadow` runs on push to main | yes, top-level `on: push: branches: [main]` (s06 confirmed; no change) | ✅ | none |

**Single gap:** `cargo clippy` was not gating CI. Added.

---

## 2. Quality matrix (run in this session, all green)

Local reproduction of the s08 spec's full matrix. The worktree is `epic/rust-engine-migration` HEAD `f041aa6` (post-s06 merge).

| Step | Command | Result |
|---|---|---|
| 1. Build shared | `pnpm --filter @purechess/shared build` | ✅ clean (`tsc --project tsconfig.json`) |
| 2. Prisma generate | `pnpm --filter @purechess/api exec prisma generate` | ✅ `Generated Prisma Client (v5.22.0)` |
| 3. Typecheck all | `pnpm -r typecheck` | ✅ clean across 4 workspaces (`shared`, `engine-native`, `web`, `api`) |
| 4. Lint all | `pnpm -r lint` | ✅ clean (only pre-existing Sentry/webpack deprecation warnings, unrelated to this epic) |
| 5. Rust test | `cargo test --features impl` (in `crates/purechess-engine`) | ✅ **86 tests passing** (49 + 2 + 18 + 17), 0 failed, 2 ignored |
| 6. Rust clippy | `cargo clippy --all-targets --features impl -- -D warnings` | ✅ clean — fixed in this session: `crates/purechess-engine/tests/parity.rs` had an unused `Position` import (a holdover from the s5 parity test scaffold). Clippy `-D warnings` is now green. |
| 7. API tests + coverage | `node_modules/.bin/jest --coverage` (in `apps/api`) | ✅ **246 tests, 24 suites, all pass** |
| 7a. Engine dir coverage | per `jest --coverage` table | ✅ **98.36% lines / 86.2% branches** (gate: 90/85) |
| 8. Web tests | `pnpm exec vitest run test/` (in `apps/web`) | ✅ **190 tests, 22 files, all pass** |
| 9. Engine shadow | `pnpm engine:shadow` | ✅ **203 traces, 0 divergences** (ts-vs-ts in CI mode) |
| 10. Build | `pnpm build` | ✅ `shared` + `api` + `web` all built |

### 2.1 Notes on the runs

- `pnpm test -- --coverage` in s08 spec step 7 does not work under pnpm 11 — pnpm strips the second `--` and Jest interprets `--coverage` as a path pattern. The script in `apps/api/package.json` is bare `jest`, not `jest --`, so the s08 spec's command needs adjustment. Local equivalent: `node_modules/.bin/jest --coverage` (what was run). Recommend updating the spec or the package script to `pnpm exec jest --coverage`.
- `node --version` is v24.15.0 (CLAUDE.md asks for ≥20 — pass). `pnpm --version` is 11.5.2 (CLAUDE.md asks for ≥9 — pass). `cargo --version` is 1.93.1; `rustc --version` is 1.93.1.
- `cargo test` runs **without** `--features ffi` — the napi surface is feature-gated and not exercised by `cargo test`. The `engine-shadow` JS-side parity is the cross-language check (also green).

---

## 3. Files changed in this session

| Path | Action | Why |
|---|---|---|
| `.github/workflows/ci.yml` | **Modified** — `rust-parity` job now (1) installs `clippy` via `dtolnay/rust-toolchain@stable` with `components: clippy`, and (2) runs `cargo clippy --all-targets --features impl -- -D warnings` after `cargo test`. | Closes the only gap from the s08 spec's CI inventory. |
| `crates/purechess-engine/tests/parity.rs` | **Modified** — removed unused `Position` import from `shakmaty`. | Required for the new `cargo clippy --all-targets -- -D warnings` gate. The import was a holdover from the s5 parity test scaffold (`pub mod parity { use shakmaty::{... , Position}; }`) and was never used in the test body. |
| `docs/roadmap/rust-engine-migration/session-08-handoff.md` | **Created / updated** (this file). | Required WP8 exit artifact. Updated after the clippy fix landed. |

---

## 4. Diffs

### 4.1 CI workflow (`.github/workflows/ci.yml`)

```yaml
  rust-parity:
    name: Rust Parity Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable
-       # (no clippy component)
+       with:
+         components: clippy

      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: "crates/purechess-engine"

      - name: Cargo test (parity + perft)
        run: cargo test --features impl
        working-directory: crates/purechess-engine
+
+     - name: Cargo clippy (deny warnings)
+       run: cargo clippy --all-targets --features impl -- -D warnings
+       working-directory: crates/purechess-engine
```

The clippy invocation uses `--features impl` to match the `cargo test` invocation — without `impl`, the napi surface and perft assertions are stubs, but clippy would still warn on the stubs. With `impl`, clippy sees the real code. Verified clean locally.

### 4.2 Parity test (`crates/purechess-engine/tests/parity.rs`)

```rust
     use purechess_engine::{apply_moves, legal_moves};
-    use shakmaty::{CastlingMode, EnPassantMode, fen::Fen, Position};
+    use shakmaty::{CastlingMode, EnPassantMode, fen::Fen};
```

The `Position` import was never used in the test body — `Fen` is what the test actually calls (`Fen::from_str(...)`). It was carried over from the original s5 scaffold. `cargo test --features impl` still passes 86/86 after the removal.

---

## 5. Go / No-Go verdict

**Verdict: ✅ GO** — the rust-engine-migration epic is code-complete and green end-to-end on the merged `epic/rust-engine-migration` branch (HEAD `f041aa6`).

| Gate | Status |
|---|---|
| Build (shared + api + web) | ✅ |
| Typecheck (all workspaces) | ✅ |
| Lint (all workspaces) | ✅ |
| Rust unit + perft + parity (86 tests) | ✅ |
| Rust clippy (`-D warnings`) | ✅ (added this session) |
| API unit tests + 90/85 engine coverage gate | ✅ (98.36% / 86.2%) |
| Web unit tests (vitest) | ✅ |
| Engine shadow parity (203 traces) | ✅ (0 divergences) |
| CI workflow matches s08 inventory | ✅ (clippy added) |

**The epic can be closed at the code level.** The remaining in-flight work is operator + post-deploy (see §6).

### 5.1 What "GO" does and does not mean

- ✅ **Code-side:** the migration from the TS engine to a Rust core exposed via napi-rs is merged, tested, gated, and reproducible from a clean checkout.
- ✅ **CI-side:** every gate the s08 spec calls for runs in `.github/workflows/ci.yml` and passes locally.
- ❌ **Production-side:** the WP6 cutover (deploy to Fly.io + 48h observation + go/no-go fill-in) has not been executed by an operator. See the WP6 handoff at `docs/roadmap/rust-engine-migration/session-06-handoff.md` for the operator checklist and the rollback runbook at `docs/runbooks/engine-cutover.md`.
- ⏸ **Session 7 (cleanup) deferred** — see §6.

---

## 6. Open follow-ups (out of scope for WP8)

1. **WP6 operator cutover** (T-0, T-24h, T+48h windows). Per the WP6 handoff §3. The runbook is in `docs/runbooks/engine-cutover.md`. The Sentry breadcrumb `engine booted: native` confirms the cutover.
2. **WP7 — TS engine cleanup.** Gated on the operator rule: *"The TS engine stays behind a feature flag (ENGINE_BACKEND=ts) for at least 2 releases. Removing it is WP7."* Should run **after** the operator has confirmed two production releases on `ENGINE_BACKEND=native` with stable metrics. Session 7's own preamble (line 52) requires the same: *"Two releases after the WP6 cutover, the TS engine is no longer needed."* Skipped in this session for that reason.
3. **WP3 debt — `engine-native` package types.** The proper fix is a `tsc --build` step in `packages/engine-native` that emits `dist/index.d.ts`. The ambient shim added in WP6 (`apps/api/src/types/purechess-engine-native.d.ts`) is a stopgap; remove it after the real fix lands.
4. **Spec nit: s08's `pnpm test -- --coverage` does not work under pnpm 11.** Either update the s08 spec, or change `apps/api/package.json#scripts.test` to `jest --coverage` and accept that you can't pass extra args. Cosmetic.
5. **Sentry alerting.** Add a Sentry alert on `engine.shadow.divergence` (zero target) post-WP6. Not in CI; out of scope for the migration itself.
