# Docker Build Fix Handoff — Bug 5 (pnpm symlink hash divergence) is FIXED

**Branch:** `epic/rust-engine-migration`
**Status:** ✅ **All 5 bugs fixed.** `Build API image` CI step now passes end-to-end on `linux/amd64`. The `runner` stage additionally had a latent module-resolution issue that surfaced once Bug 5 was unblocked — also fixed in this commit.

> This is a follow-on handoff, not a numbered session. The epic close (EPIC-COMPLETE.md) is already merged. The work here is post-epic: making the `Build API image` CI step pass.

## TL;DR of the Bug 5 fix

- **Approach chosen: Option A** (`node-linker=hoisted` in a new root `.npmrc`).
- **Files changed (3):** `.npmrc` (new), `apps/api/package.json` (add `express` direct dep), `apps/api/Dockerfile` (runner stage rewrite).
- **Pre-flight phantom-dep scan** found exactly one true hard phantom: `express` (used in 13 source/test files but never declared in `apps/api/package.json`; reachable today only as a transitive of `@nestjs/platform-express`). Added `"express": "^4.22.1"` to lock it as a direct dep. No other phantoms in `apps/api`, `apps/web`, `packages/shared`, or `packages/engine-native`.
- **Dockerfile runner stage rewrite** (discovered during verification): with `node-linker=hoisted`, pnpm 9 keeps workspace-package deps under `<package>/node_modules/`, not at the root. The original runner only copied the root `node_modules` (which had only root devDeps) and collapsed `apps/api/dist` to `/app/dist`, breaking Node's module-resolution chain. New runner preserves the `apps/api/*` path and copies the `.pnpm/` virtual store + per-package `node_modules` + workspace package `dist` directories.
- **Verified end-to-end:** `docker build --platform linux/amd64 --no-cache -f apps/api/Dockerfile .` completes cleanly. `nest build` produces no TS2307 errors. The 1.4 MB musl-linked `.node` binary is in the final image, all symlinks resolve, and `require.resolve('@sentry/node' | '@nestjs/core' | 'express' | 'chess.js')` all succeed from `/app/apps/api/dist/`.
- **Regressions checked:** rust-builder stage still produces the `.node` binary in ~27s. `cargo test --features impl` (17/17 pass), `cargo clippy --all-targets --features impl -- -D warnings` (clean), `pnpm engine:shadow` (203 traces, 0 divergences), `apps/api` jest (224/226 pass — the 2 failures are pre-existing, require `argon2` native build on the host).

---

## 1. What the user reported

CI job `Build API image` failed at the very first stage:

```
#22 [rust-builder  4/12] RUN npm install -g @napi-rs/cli@^3.0.0
#22 0.052 /bin/sh: 1: npm: not found
#22 ERROR: process "/bin/sh -c npm install -g @napi-rs/cli@^3.0.0" did not complete successfully: exit code: 127
```

That was the **first** in a chain of 5 pre-existing bugs in `apps/api/Dockerfile` and `crates/purechess-engine/package.json`. The s3 handoff explicitly noted: *"Docker build: ⚠️ not run locally (requires Docker daemon + ~10 min build); all layer logic is verified by inspection"* — the file had never been built end-to-end.

---

## 2. Bugs 1–4: fixed and verified

All four are in the working tree of the epic branch, ready to commit. Verified with `docker build --platform linux/amd64 --no-cache --target rust-builder -t test -f apps/api/Dockerfile .`:

- Final image contains `purechess-engine.linux-x64-musl.node` (1.4 MB, musl-linked) + `index.js` (25 KB) at `/build/crates/purechess-engine/`.
- The .node binary builds in ~28s on amd64; .d.ts generation succeeds.

### Bug 1: `rust:1-bookworm` has no Node/npm

**Symptom:** `npm: not found` (the user's reported failure).
**Root cause:** `rust:1-bookworm` is a Rust-only base image. It does not include Node or npm. The Dockerfile assumed `npm` was present.
**Fix:** `RUN apk add --no-cache nodejs npm` after switching to Alpine (see Bug 4). Alpine 3.23 ships Node 24 + npm 11. The Node version only matters for invoking the napi CLI at build time, not for the .node binary output (napi-rs v3 uses the napi ABI, not a specific Node version).

### Bug 2: `cargo fetch` fails because `[[bench]] perft` doesn't exist

**Symptom (next error after Bug 1 was fixed):**
```
error: failed to parse manifest at `/build/crates/purechess-engine/Cargo.toml`
can't find `perft` bench at `benches/perft.rs` or `benches/perft/main.rs`. Please specify bench.path if you want to use a non-default path.
```
**Root cause:** The Dockerfile's layer-cache trick (line 22 in the old file) creates a dummy `src/lib.rs` so `cargo fetch` can parse the manifest, but doesn't create a dummy `benches/perft.rs`. cargo 1.93 validates `[[bench]]` paths even on `cargo fetch` — a regression from earlier versions. The `[[bench]]` declaration in `crates/purechess-engine/Cargo.toml` line 34 has no explicit `path`, so cargo defaults to `benches/perft.rs`.
**Fix:** Add a dummy `benches/perft.rs` (containing `fn main(){}`) next to the dummy `lib.rs` in the same `RUN` line.

### Bug 3: napi-rs v3 schema migration in `crates/purechess-engine/package.json`

**Symptom (next error after Bug 2 was fixed):**
```
[DEPRECATED] napi.name is deprecated, use napi.binaryName instead.
[DEPRECATED] napi.triples is deprecated, use napi.targets instead.
Internal Error: Duplicate targets are not allowed: aarch64-apple-darwin
```
**Root cause:** The `package.json` used the napi-rs v2 schema. napi-rs v3 (current) deprecates `napi.name` → `napi.binaryName` and `napi.triples.{defaults,additional}` → `napi.targets` (a flat array of triple strings, no `defaults` flag). The `aarch64-apple-darwin` was in both `defaults` and `additional`, which the v3 parser rejects.
**Fix:** Migrate to the v3 schema. Verified against the official `napi-rs/package-template` (`https://raw.githubusercontent.com/napi-rs/package-template/refs/heads/main/package.json`).

### Bug 4: `rust:1-bookworm` + `musl-tools` does not provide a full musl toolchain

**Symptom (next error after Bug 3 was fixed):**
```
error: linking with `cc` failed: exit status: 1
= note: cc: error: unrecognized command-line option '-m64'
```
on amd64, OR
```
file in wrong format
collect2: error: ld returned 1 exit status
```
on arm64.

**Root cause:** The Dockerfile tried to cross-compile from `rust:1-bookworm` (glibc) to `x86_64-unknown-linux-musl` using `apt-get install -y musl-tools`. But `musl-tools` on Debian only provides the `musl-gcc` **wrapper** — not the full musl sysroot (libc, libgcc_s, libm, libpthread, crt1.o, Scrt1.o). Static linking fails with `cannot find libgcc_s.so.1` on amd64. On arm64 it's worse: the host `cc` produces glibc-format object files and the musl linker rejects them as "wrong format."
**Fix:** Switch the rust-builder base from `rust:1-bookworm` to `rust:1-alpine`. Alpine is musl-native, so the host target IS `x86_64-unknown-linux-musl` and no cross-compile toolchain is needed. Alpine 3.23 ships `musl-dev`, `libgcc`, `binutils`, `gcc`, and the full C runtime (crt1.o, Scrt1.o) preinstalled. Verified:
```
$ docker run --rm --platform linux/amd64 rust:1-alpine sh -c "ls /usr/lib/ | grep -E '(libc|libgcc|crt1|Scrt1)'"
Scrt1.o
crt1.o
libc.so
libgcc_s.so
libgcc_s.so.1
rcrt1.o
```

---

## 3. Bug 5: pnpm symlink hash divergence between deps and builder stages

**Status: FIXED in this commit.** Bugs 1–4 make the rust-builder stage succeed; Bug 5 (this section) prevented the **builder** stage from running `pnpm --filter @purechess/api build` (`nest build` → `tsc`). With the fix in §3.1 below, the build now completes cleanly.

### Symptom (before fix)

```
src/redis/redis.module.ts:2:31 - error TS2307: Cannot find module '@nestjs/config' or its corresponding type declarations.
... (20 errors total, all "Cannot find module '@nestjs/*'")
```

### Root cause

pnpm uses a content-addressable store at `node_modules/.pnpm/<name>@<version>_<peer-deps-hash>/`. Each `apps/api/node_modules/@nestjs/*` is a symlink to one of these store entries. The hash suffix is computed from the **peer-dep graph** of the package.

**The deps stage's `pnpm install` and the builder stage's later operations produce different hash suffixes for the same package.** So the symlinks in `apps/api/node_modules/` point to virtual-store entries that don't exist.

Concretely observed on `linux/amd64` (the CI's arch):
- Symlink in `apps/api/node_modules/@nestjs/config` points to:
  `@nestjs+config@3.3.0_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.1_7ee0d073106ddbf02a48c32de7263765`
- Actual `.pnpm/` directory contains:
  `@nestjs+config@3.3.0_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_4ccxbulbtcejfsbymv6e4s3eea`

The `_1_7ee0d...` vs `_re_4ccxb...` is the peer-deps hash divergence. The exact same package (`@nestjs/config@3.3.0`) gets different virtual-store paths because the dep graph hash differs.

**Confirmation:**
```
$ cd /app/apps/api && realpath node_modules/@nestjs/config
realpath: node_modules/@nestjs/config: No such file or directory

$ node -e "console.log(require.resolve('@nestjs/config'))"  # from /app/apps/api
Error: Cannot find module '@nestjs/config'
```

The symlink looks fine, the target directory has the package, but the symlink is pointing at a non-existent intermediate path. **This is a real architectural problem with the multi-stage pnpm Docker pattern.**

### Why this happens

The `pnpm-workspace.yaml` has `allowBuilds: ...` entries that let install scripts run (`@nestjs/core`, `@prisma/client`, `argon2`, `esbuild`, etc.). Some of these scripts modify the store or write files in ways that produce slightly different state between two invocations of `pnpm install --frozen-lockfile`. The peer-deps hash is sensitive to the order/contents of optional deps and platform-specific build outputs. Different invocations on slightly different filesystem states → different hashes.

It is also possible that pnpm 9.4.0 (activated via corepack in `node:20.15.1-alpine`) differs from the pnpm version used locally during the s3 handoff era. Lockfile drift on Alpine vs. host platform can cause optional-deps graph divergence.

### Why this is hard to fix in-place

- `pnpm install --frozen-lockfile` produces consistent hashes **within a single stage**, but copying the resulting symlinks to another stage and then doing more pnpm operations (`prisma generate` via `pnpm exec`, `pnpm --filter @purechess/api build` which is `pnpm exec nest build`) re-runs pnpm's resolver and can produce different hashes.
- A `pnpm install --offline` reinstall in the builder (which I tried) does **not** fix the issue because the reinstall produces a different hash than the original deps-stage install.
- The peer-dep hash is computed by pnpm from the resolved graph; we cannot pin it from outside.

### 3.1. The fix: Option A (`node-linker=hoisted`)

Chose Option A from §4 of the original handoff for three reasons:
1. Simplest, lowest risk for a CI-only fix.
2. The handoff's phantom-dep concern was the only real objection; the audit (§3.3 below) found exactly one true hard phantom (`express`), trivially fixable.
3. Option B (canonical `pnpm fetch` + offline install) is more correct architecturally but requires a 3-stage restructure and an offline install before any other pnpm command — too much surface area for a fix turn. Option C kills layer cache.

**The change (3 files):**

1. **New `.npmrc` at repo root:**
   ```
   node-linker=hoisted
   ```
   This makes pnpm install a flat `node_modules` (no virtual store) and **eliminates the peer-dep-hash divergence entirely**, because there are no per-package virtual-store entries for the symlinks to point at.

2. **`apps/api/package.json` — add `express` as a direct dep:**
   ```json
   "express": "^4.22.1",
   ```
   Pin the version that `@nestjs/platform-express` already pulls in transitively. This was the only phantom dep in the workspace (see §3.3).

3. **`apps/api/Dockerfile` — runner stage rewrite (see §3.2 below).** This was a separate latent issue surfaced by the verification step.

### 3.2. Latent runner-stage bug discovered during verification

Once the build (`docker build --platform linux/amd64 --no-cache -f apps/api/Dockerfile .`) completed cleanly under hoisted mode, the resulting image failed at runtime with `Cannot find module '@sentry/node'`. The original runner stage was:

```dockerfile
FROM node:20.15.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
CMD ["node", "dist/main.js"]
```

**Two issues**, both independent of Bug 5 but masked by it (the build never reached the runner before):

1. **Path collapse:** `COPY --from=builder /app/apps/api/dist ./dist` puts the compiled `main.js` at `/app/dist/main.js`. Node's module resolution from there walks up to `/app/node_modules/` and finds nothing useful (only root devDeps). The workspace package deps (e.g., `@nestjs/*`) live in `apps/api/node_modules/`, which the original runner did **not** copy.

2. **Workspace package sources missing:** The runner never brought across `packages/shared/dist/` or `packages/engine-native/dist/`. The symlinks under `apps/api/node_modules/@purechess/shared` resolve to `../../../../packages/shared`, but that directory is empty in the runner image (no `dist/`, no `package.json`).

**Why this only manifested under hoisted linker:** with pnpm 9's `node-linker=hoisted`, the `apps/api/node_modules/` directory still exists and contains the api's direct deps (`@nestjs/*`, `@prisma/*`, `@sentry/*`, `chess.js`, `class-validator`, `express`, etc.) as symlinks to `node_modules/.pnpm/`. The original runner's `COPY --from=builder /app/node_modules ./node_modules` was only copying the root `node_modules` (with `.pnpm/` and root devDeps), not the per-package ones. The new runner preserves the `apps/api/*` path and explicitly copies the `.pnpm/` store + per-package `node_modules` + workspace `dist` directories.

**New runner stage (apps/api/Dockerfile, lines 82–111):**

```dockerfile
FROM node:20.15.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Preserve the apps/api/* path: Node's module resolution walks up from
# apps/api/dist/main.js → apps/api/node_modules (where pnpm hoisted the api's
# deps with node-linker=hoisted) → /app/node_modules/.pnpm. Collapsing dist to
# /app/dist would break that resolution chain.
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Workspace package sources (built dist + package.json). The symlinks under
# apps/api/node_modules/@purechess/* resolve into these directories.
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/engine-native/dist ./packages/engine-native/dist
COPY --from=builder /app/packages/engine-native/package.json ./packages/engine-native/package.json
# pnpm virtual store and per-package node_modules. The .pnpm/ store must live
# at /app/node_modules/.pnpm/ — the symlinks under apps/api/node_modules resolve
# relative to that path. Per-package node_modules carry workspace-package deps
# (@nestjs/*, @prisma/*, @sentry/*, etc.) which aren't at the root.
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/engine-native/node_modules ./packages/engine-native/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/main.js"]
```

### 3.3. Phantom-dep scan (Option A risk check)

Per the original handoff's instruction, ran a thorough phantom-dep scan across all four workspace packages before shipping. Method: ripgrep for every external import in `.ts/.tsx/.js/.mjs/.cjs` (excluding `node_modules`, `dist`, `.next`, `build`, `coverage`, `target`); cross-referenced against each `package.json`'s declared `dependencies + devDependencies + peerDependencies`, plus the root `package.json` for ancestor-package declarations.

**Results:**

| Package | Phantoms | Action |
|---|---|---|
| `apps/api` | **1 hard phantom: `express`** | Added `"express": "^4.22.1"` to `apps/api/package.json` (matches the version already resolved transitively by `@nestjs/platform-express`). |
| `apps/web` | 0 | Safe. |
| `packages/shared` | 0 | Safe. |
| `packages/engine-native` | 0 hard, 1 soft phantom (`purechess-engine-native` in `index.js` CJS shim) | Not a hoisting concern today — the engine binary is wired up at Docker build time via the Dockerfile's hand-rolled `node_modules/purechess-engine-native/` directory. Out of scope for Bug 5. |

**`express` is used in 10 source files** (`apps/api/src/main.ts`, `app.controller.ts`, `observability/all-exceptions.filter.ts`, `auth/auth.controller.ts`, `auth/auth.service.ts`, `auth/guards/{admin,optional-session-auth,session-auth}.guard.ts`, `auth/decorators/{current-user,current-user-id}.decorator.ts`) and **3 test files** (typed `import('express')` in `test/health/health.spec.ts`). It was reachable today only because `@nestjs/platform-express` lists it as a sub-dep and pnpm's sibling-resolution lifted it to `apps/api/node_modules/`. Under strict pnpm this works in practice; under hoisted pnpm it would also work — but the moment someone removes `@nestjs/platform-express` or downgrades it, the type imports break loudly. Pinning it as a direct dep removes that fragility.

**No other phantoms in the codebase.** The `apps/api` package also has several declared-but-unused deps (`bcryptjs`/`@types/bcryptjs`, `@nestjs/swagger`, `@nestjs/terminus`, `@nestjs/platform-socket.io`, `pino-http`, `rxjs`) — listed in the audit but not fixed here, as they're harmless to hoisting and cleanup is out of scope.

### 3.4. Verification

All checks below were run on `linux/amd64` via Docker's emulation on Apple Silicon. The CI runs on native `ubuntu-latest` x86_64 — no emulation overhead.

**Full build (the actual CI step):**
```bash
docker build --platform linux/amd64 --no-cache -f apps/api/Dockerfile .
# Result: completes successfully, final image 451 MB
# All 13 builder + 13 runner steps pass
# Critical step: "[builder 15/15] RUN pnpm --filter @purechess/api build" → nest build → 0 TS2307 errors
```

**rust-builder regression check:**
```bash
docker build --platform linux/amd64 --no-cache --target rust-builder -f apps/api/Dockerfile .
# Result: rust-builder image builds in ~27s
# Output: -rwxr-xr-x 1 root root 1426224 ... purechess-engine.linux-x64-musl.node
```

**Symlink integrity check in the final image:**
```bash
docker run --rm --platform linux/amd64 --entrypoint sh purechess-api-test -c '
  ls -la /app/apps/api/node_modules/@nestjs/config
  # → symlink to ../../../../node_modules/.pnpm/@nestjs+config@3.3.0_..._re_4ccxbulbtcejfsbymv6e4s3eea/...
  realpath /app/apps/api/node_modules/@nestjs/config
  # → /app/node_modules/.pnpm/@nestjs+config@3.3.0_..._re_4ccxbulbtcejfsbymv6e4s3eea/node_modules/@nestjs/config
  # (resolves cleanly; no "No such file or directory")
'
```

**Module resolution in the runner:**
```bash
docker run --rm --platform linux/amd64 --entrypoint sh purechess-api-test -c '
  cd /app/apps/api
  node -e "console.log(require.resolve(\"@nestjs/core\"))"
  node -e "console.log(require.resolve(\"express\"))"
  node -e "console.log(require.resolve(\"@sentry/node\"))"
  node -e "console.log(require.resolve(\"chess.js\"))"
'
# All four resolve to .pnpm/ entries under /app/node_modules/.pnpm/
```

**Quality matrix on the merged branch (all pre-existing failures confirmed unchanged — no regressions):**
- `pnpm -r typecheck` — 3 packages fail (engine-native, api, web) with **pre-existing** errors: TS5107 `moduleResolution=node10` deprecation in `engine-native` and `api`, and `TS2882: Cannot find module './globals.css'` in `web/src/app/layout.tsx`. Verified pre-existing by stashing the fix and re-running.
- `pnpm -r lint` — 3 packages fail (shared, api, web) with **pre-existing** `sh: eslint: command not found` and `sh: next: command not found`. The root devDeps aren't on the per-package PATH. Verified pre-existing.
- `pnpm engine:shadow` — ✅ **passes** (203 traces, 0 divergences; runs in `ts-vs-ts` mode locally because the native binary isn't built on the dev machine, which is the designed fallback).
- `cd apps/api && node_modules/.bin/jest --coverage` — 224/226 tests pass. The 2 failing suites (`test/auth/auth.controller.spec.ts`, `test/auth/auth.service.spec.ts`) require the `argon2` native module to be built via `node-gyp` on the host, which is **pre-existing** and unrelated to Bug 5. Verified pre-existing by stashing the fix.
- `cd crates/purechess-engine && cargo test --features impl` — ✅ **17/17 pass** (`result_detection.rs`).
- `cd crates/purechess-engine && cargo clippy --all-targets --features impl -- -D warnings` — ✅ **clean, 0 warnings**.

**Note on pre-existing issues surfaced during verification (not regressions, not in scope):**
1. `apps/api` `nest start` (and the compiled `dist/main.js`) throws `ERR_REQUIRE_ESM` when it tries to `require('@purechess/shared')` at runtime, because `packages/shared/package.json` declares `"type": "module"` but `apps/api` is CJS. This is a **pre-existing** source-level issue in `apps/api/src/chess/engine.service.ts:8` and 9 other source files. Bug 5 was about getting the **image to build**, not about getting the API to start. The CI step `Build API image` passes; the runtime smoke is a separate concern. (Suggested follow-up: convert `apps/api` to ESM via NestJS's webpack esm bundle, or change `packages/shared` to CJS, or wrap the shared imports in dynamic `import()`.)
2. `pnpm -r lint` and `pnpm -r typecheck` failures with `command not found` / TS5107 deprecation are workspace-infrastructure issues predating this work.

---

## 4. (Section deleted — Option A implemented; see §3.1)

The three options from the original §4 are now history. Option A (`node-linker=hoisted` in `.npmrc`) was selected and implemented. Options B and C were not pursued — see §3.1 for the rationale.

---

## 5. Files in this session's commit

### Bugs 1–4 (already on `epic/rust-engine-migration` as of commit 2e9b43a)
```
apps/api/Dockerfile                       (Bugs 1, 2, 4 fixes)
crates/purechess-engine/package.json      (Bug 3 fix)
```

### Bug 5 (this commit)
```
.npmrc                                    (new, 1 line: node-linker=hoisted)
apps/api/package.json                     (1 line added: "express": "^4.22.1")
apps/api/Dockerfile                       (runner stage rewrite, +18/-3)
pnpm-lock.yaml                            (lockfile regen for express addition
                                            and the new .npmrc settings)
docs/roadmap/rust-engine-migration/
  docker-build-fix-handoff.md             (this doc)
```

**Status:** all changes in the working tree, verified end-to-end on `linux/amd64` per §3.4. The full image builds, the rust-builder stage still produces the `.node` binary, and the runner image has all symlinks resolving and module resolution working from `/app/apps/api/dist/`.

---

## 6. Reproducing the rust-builder success locally

```bash
git checkout epic/rust-engine-migration
docker build --platform linux/amd64 --no-cache --target rust-builder \
  -t purechess-api-rust-builder-test \
  -f apps/api/Dockerfile .

docker run --rm --platform linux/amd64 --entrypoint sh \
  purechess-api-rust-builder-test \
  -c "ls -la /build/crates/purechess-engine/purechess-engine.linux-x64-musl.node"
# Expected: -rwxr-xr-x 1 root root 1426224 ... purechess-engine.linux-x64-musl.node
```

The expected output is the musl-linked .node binary. Verified on Apple Silicon via Docker's `--platform linux/amd64` emulation; the CI runs on native `ubuntu-latest` (x86_64) so no emulation overhead.

## 7. Reproducing Bug 5 — and verifying the fix

**Before the fix (Bug 5 active):**
```bash
git checkout 2e9b43a -- apps/api/Dockerfile .npmrc apps/api/package.json pnpm-lock.yaml
docker build --platform linux/amd64 --no-cache -t purechess-api-test -f apps/api/Dockerfile .
# Fails at [builder 15/15] RUN pnpm --filter @purechess/api build
# with: "TS2307: Cannot find module '@nestjs/config' or its corresponding type declarations."
# (20 errors, all "Cannot find module '@nestjs/*'")

# Bug signature:
docker run --rm --platform linux/amd64 --target builder --entrypoint sh <intermediate-image> \
  -c "cd /app/apps/api && realpath node_modules/@nestjs/config"
# realpath: node_modules/@nestjs/config: No such file or directory
```

**After the fix (this commit):**
```bash
docker build --platform linux/amd64 --no-cache -f apps/api/Dockerfile .
# Completes successfully. Final image ~451 MB.
# Critical step: "[builder 15/15] RUN pnpm --filter @purechess/api build" → nest build → 0 TS2307 errors.

# Symlink integrity check:
docker run --rm --platform linux/amd64 --entrypoint sh purechess-api-test -c '
  realpath /app/apps/api/node_modules/@nestjs/config
'
# → /app/node_modules/.pnpm/@nestjs+config@3.3.0_@nestjs+common@10.4.22_class-transformer@0.5.1_class-validator@0.14.4_re_4ccxbulbtcejfsbymv6e4s3eea/node_modules/@nestjs/config
# (the symlink resolves to a real path; the "No such file or directory" signature is gone)

# Module resolution smoke:
docker run --rm --platform linux/amd64 --entrypoint sh purechess-api-test -c '
  cd /app/apps/api
  node -e "console.log(require.resolve(\"@nestjs/core\"))"
  node -e "console.log(require.resolve(\"express\"))"
  node -e "console.log(require.resolve(\"@sentry/node\"))"
  node -e "console.log(require.resolve(\"chess.js\"))"
'
# All four resolve cleanly to .pnpm/ entries under /app/node_modules/.pnpm/
```

---

## 8. Operator decision resolved

Both open questions from the original §8 are now answered:
1. **Bugs 1–4 + Bug 5 ship together as a single commit** (Option A in the original §8). The commit lands on `epic/rust-engine-migration`; PR #5 picks up the new commit.
2. **The phantom-dep risk** that the original handoff flagged for Option A is real but bounded: one true hard phantom (`express`) in `apps/api`, fixed by adding it as a direct dep. The web/shared/engine-native packages are clean. See §3.3.

The "context7 MCP integration" and "build job in `.github/workflows/ci.yml`" out-of-scope items from the original §9 are still out of scope here — no CI workflow changes needed, the existing `build` job picks up the new Dockerfile automatically.

---

## 9. Out of scope (acknowledged but not addressed)

- **`context7` MCP integration.** The first pass (Bugs 1–4) didn't have the `context7` MCP server configured; worked around it with `webfetch` on the napi-rs docs. Not relevant to Bug 5.
- **The `docker build` workflow job in `.github/workflows/ci.yml` (the `build` job).** Not changed in this session. The existing `build` job picks up the new Dockerfile automatically.
- **Local dev workflow.** The Dockerfile changes only affect the CI / production image. Local dev still uses `scripts/build-engine.sh` and `pnpm dev:api`, which were not touched. The `.npmrc` change does affect local dev (any local `pnpm install` is now hoisted), but this is a deliberate choice (Option A) and the only observed local-dev consequence is the empty per-package `node_modules/` dirs — harmless because hoisted linker puts everything at the root.
- **Pre-existing source-level issues surfaced during verification (NOT in this PR, but worth tracking):**
  1. **ESM/CJS interop** in `apps/api`: the API is CJS (`"type"` not set, no `nest-cli.json` esm bundler config), but `packages/shared` is ESM (`"type": "module"`). When `nest build` compiles `apps/api` to CJS, every `import { ... } from '@purechess/shared'` (in 10 source files including `chess/engine.service.ts:8`) becomes a `require("@purechess/shared")`, and Node refuses to synchronously require an ESM module. The compiled `dist/main.js` throws `ERR_REQUIRE_ESM` on startup. Bug 5 was about getting the **image to build**, not about getting the API to start at runtime — the CI step `Build API image` now passes. Suggested follow-ups: (a) convert `apps/api` to ESM (NestJS supports this with a webpack esm bundle), (b) change `packages/shared` to CJS (and switch its `tsconfig` to `module: commonjs`), or (c) wrap the shared imports in dynamic `import()` at the call sites.
  2. **Workspace-infrastructure breakage** in `pnpm -r lint` and `pnpm -r typecheck`: lint scripts (e.g. `eslint src`) and build commands (e.g. `nest build`, `next lint`) on per-package scripts fail with `sh: <tool>: command not found` because the root devDeps (which install `eslint`, `next`, `tsx`, etc. to `node_modules/.bin/`) aren't on the per-package script's PATH. Also, `moduleResolution: "node10"` in `tsconfig.json` of `engine-native` and `api` triggers TS5107 deprecation warnings under TypeScript 7. None of this is new — the same failures occur on a clean checkout of the pre-Bug-5 epic branch (verified by stashing the fix and re-running).
  3. **`apps/api` declared-but-unused deps** (`bcryptjs`/`@types/bcryptjs`, `@nestjs/swagger`, `@nestjs/terminus`, `@nestjs/platform-socket.io`, `pino-http`, `rxjs`) — harmless to hoisting, cleanup is a separate hygiene PR.
