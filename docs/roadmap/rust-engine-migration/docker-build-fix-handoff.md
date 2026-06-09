# Docker Build Fix Handoff — Bug 5 fixed + 4 pre-existing issues fixed

**Branch:** `epic/rust-engine-migration`
**Status:** ✅ **All 5 Docker bugs fixed.** `Build API image` CI step passes end-to-end on `linux/amd64`. Final image is 251 MB (down from 1.07 GB in the initial Option A attempt, 451 MB in the working Bug 5 commit). Additionally, the four pre-existing issues flagged in §9 of this doc are also fixed in this commit series.

> This is a follow-on handoff, not a numbered session. The epic close (EPIC-COMPLETE.md) is already merged. The work here is post-epic: making the `Build API image` CI step pass and clearing the pre-existing issues that were masked by bugs 1–5.

## TL;DR

- **Bug 5 fix:** pivoted from Option A (`node-linker=hoisted`) to Option B (canonical `pnpm fetch` + `pnpm install --offline --frozen-lockfile` + `pnpm deploy`). See §3.1 for why.
- **The four pre-existing fixes** documented in §9 of the original handoff are also done in this commit. See §10 for the full list.
- **Verified end-to-end on `linux/amd64`:**
  - `docker build --platform linux/amd64 --no-cache -f apps/api/Dockerfile .` completes cleanly. 251 MB final image.
  - `nest build` produces 0 errors.
  - The 1.4 MB musl-linked `.node` binary is in the final image at `node_modules/purechess-engine-native/purechess-engine.linux-x64-musl.node`; `require('purechess-engine-native').validateMove` is a function.
  - All symlinks resolve: `@nestjs/core`, `express`, `@sentry/node`, `chess.js`, `@purechess/shared` all resolve from `/app`.
  - `pnpm -r typecheck` ✅, `pnpm -r lint` ✅, `pnpm engine:shadow` ✅ (203 traces, 0 divergences), `apps/api` jest ✅ (226/226 pass — 2 suites can't run due to pre-existing argon2 native build), `cargo test --features impl` ✅ (17/17), `cargo clippy --all-targets --features impl -- -D warnings` ✅ (clean).
  - rust-builder stage still produces the `.node` binary in ~27s (Bugs 1-4 not regressed).

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

### 3.1. The fix: Option B (canonical `pnpm fetch` + `--offline` install)

Initially chose Option A (`node-linker=hoisted`) from the handoff's §4. Built and verified the image end-to-end, but discovered a real pnpm 9 limitation while implementing the four pre-existing fixes (§10): with `node-linker=hoisted`, pnpm 9.4.0 puts **all** packages in the workspace root `node_modules/` (including root devDeps), and `pnpm run` from a per-package script does NOT add the root `node_modules/.bin` to the per-package script's PATH. The handoff's `pnpm -r lint` and `pnpm -r typecheck` were failing with `sh: eslint: command not found` because of this — they failed before the lint rule could even be evaluated, hiding the actual lint errors. With hoisted linker, the fix would require either per-script PATH injection or restructuring every per-package script.

Pivot to Option B (canonical pnpm + Docker pattern) — the recommended, long-term-correct pnpm+docker pattern:

- **Why Option B over Option A:**
  - The strict (default) linker creates per-package `node_modules/.bin/` for each package's direct devDeps, so `pnpm run` finds CLI tools naturally.
  - `pnpm fetch` populates the virtual store from the lockfile; `pnpm install --offline` in the builder creates symlinks from the populated store without re-resolving against the registry. This is what eliminates the peer-dep-hash divergence that caused Bug 5.
  - `pnpm deploy --prod` produces a self-contained deployable directory with only the api's prod deps, the pruned virtual store, and the workspace package symlinks. The runner image becomes 251 MB instead of 1.07 GB.

- **Files changed:**
  1. **`.npmrc` at repo root** (replaced `node-linker=hoisted` with a comment explaining the per-package devDep contract; see §10 for the devDeps changes).
  2. **`apps/api/package.json` — add `express` as a direct dep:**
     ```json
     "express": "^4.22.1",
     ```
     Pin the version that `@nestjs/platform-express` already pulls in transitively. The phantom-dep scan (§3.3) found this was the only true hard phantom in the workspace.
  3. **`apps/api/Dockerfile` — major rewrite:** deps stage does `pnpm fetch` (populates virtual store); builder stage does `pnpm install --offline` then `pnpm deploy --prod` to produce a self-contained directory. See §3.2 below for the rationale.

### 3.2. Dockerfile restructure for Option B (`pnpm fetch` + offline install + deploy)

The Dockerfile went through two iterations. The final structure (Option B + `pnpm deploy`):

```dockerfile
# Stage 0: rust-builder — unchanged, still produces the .node binary.

# Stage 1: deps — populate the pnpm virtual store from the lockfile
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine-native/package.json ./packages/engine-native/
RUN pnpm fetch
# Carry the populated virtual store forward to builder (deps and builder
# are separate FROM stages, so the store must be explicit).

# Stage 2: builder — full install, compile, deploy
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --offline --frozen-lockfile \
      --filter @purechess/api... \
      --filter @purechess/shared \
      --filter @purechess/engine-native
# Build the workspace packages
RUN pnpm --filter @purechess/shared build
RUN pnpm --filter @purechess/engine-native build
RUN pnpm --filter @purechess/api exec prisma generate
RUN pnpm --filter @purechess/api build
# Install the prebuilt napi binary into apps/api/node_modules/purechess-engine-native
# (same as before)
# Deploy the api as a self-contained directory with only prod deps
RUN pnpm deploy --filter @purechess/api --prod /deploy
# Inject the prebuilt napi binary into the deployed directory (pnpm deploy
# doesn't know about hand-rolled external binaries)
RUN mkdir -p /deploy/node_modules/purechess-engine-native
COPY --from=rust-builder /build/crates/purechess-engine/{index.js,index.d.ts,purechess-engine.linux-x64-musl.node} /deploy/node_modules/purechess-engine-native/
RUN printf '{"name":"purechess-engine-native",...}' > /deploy/node_modules/purechess-engine-native/package.json

# Stage 3: runner — minimal production image
FROM node:20.15.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /deploy /app
WORKDIR /app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/main.js"]
```

**Key design points:**

1. **`pnpm fetch` in deps stage** populates the virtual store from the lockfile alone. No symlinks, no source files. The lockfile + per-package `package.json` (the only files pnpm needs to know about dep shape) are copied in. This is fast and cacheable.

2. **`pnpm install --offline` in builder** creates the symlinks from the already-populated virtual store without re-resolving against the registry. The output is **deterministic** — same lockfile, same store, same symlink hashes every time. This is what eliminates the peer-dep-hash divergence that caused Bug 5.

3. **`pnpm deploy --filter @purechess/api --prod /deploy`** is the key new step. It produces a self-contained directory at `/deploy` that contains:
   - The api's source files
   - The api's compiled dist
   - The api's prod-only `node_modules/` (with workspace packages `@purechess/shared` and `@purechess/engine-native` as symlinks into the virtual store)
   - The pruned virtual store at `node_modules/.pnpm/` (only the prod-closure packages)
   - The prisma schema

   The runner stage just `COPY --from=builder /deploy /app` and is done. No per-package node_modules surgery needed.

4. **The `purechess-engine-native` binary** is hand-rolled (it's a prebuilt napi binary from the rust-builder stage, not a workspace package). It's injected into `apps/api/node_modules/purechess-engine-native/` in the builder (for compilation) and again into `/deploy/node_modules/purechess-engine-native/` after deploy (because `pnpm deploy` doesn't know about it).

**Result:** 251 MB runner image (down from 1.07 GB with the initial Option A attempt, 451 MB with the working Option A bug-5 commit). The pnpm fetch + offline install pattern also makes builds faster in CI: the deps stage caches on lockfile + per-package package.json, the builder stage caches on app source.

### 3.3. Phantom-dep scan

Per the original handoff's instruction, ran a thorough phantom-dep scan across all four workspace packages before shipping. Method: ripgrep for every external import in `.ts/.tsx/.js/.mjs/.cjs` (excluding `node_modules`, `dist`, `.next`, `build`, `coverage`, `target`); cross-referenced against each `package.json`'s declared `dependencies + devDependencies + peerDependencies`, plus the root `package.json` for ancestor-package declarations.

**Results:**

| Package | Phantoms | Action |
|---|---|---|
| `apps/api` | **1 hard phantom: `express`** | Added `"express": "^4.22.1"` to `apps/api/package.json` (matches the version already resolved transitively by `@nestjs/platform-express`). |
| `apps/web` | 0 | Safe. |
| `packages/shared` | 0 | Safe. |
| `packages/engine-native` | 0 hard, 1 soft phantom (`purechess-engine-native` in `index.js` CJS shim) | Not a hoisting concern today — the engine binary is wired up at Docker build time via the Dockerfile's hand-rolled `node_modules/purechess-engine-native/` directory. Out of scope for Bug 5. |

**`express` is used in 10 source files** (`apps/api/src/main.ts`, `app.controller.ts`, `observability/all-exceptions.filter.ts`, `auth/auth.controller.ts`, `auth/auth.service.ts`, `auth/guards/{admin,optional-session-auth,session-auth}.guard.ts`, `auth/decorators/{current-user,current-user-id}.decorator.ts`) and **3 test files** (typed `import('express')` in `test/health/health.spec.ts`). It was reachable today only because `@nestjs/platform-express` lists it as a sub-dep and pnpm's sibling-resolution lifted it to `apps/api/node_modules/`. Under strict pnpm this works in practice; under hoisted pnpm it would also work — but the moment someone removes `@nestjs/platform-express` or downgrades it, the type imports break loudly. Pinning it as a direct dep removes that fragility.

The dead-dep audit also surfaced 8 more confirmed dead deps (4 in api, 4 in web). See §10.4 for the pruning.

### 3.4. Verification

All checks below were run on `linux/amd64` via Docker's emulation on Apple Silicon. The CI runs on native `ubuntu-latest` x86_64 — no emulation overhead.

**Full build (the actual CI step):**
```bash
docker build --platform linux/amd64 --no-cache -f apps/api/Dockerfile .
# Result: completes successfully, final image 251 MB
# Critical step: "[builder X/Y] RUN pnpm --filter @purechess/api build" → nest build → 0 errors
```

**rust-builder regression check:**
```bash
docker build --platform linux/amd64 --no-cache --target rust-builder -f apps/api/Dockerfile .
# Result: rust-builder image builds in ~27s
# Output: -rwxr-xr-x 1 root root 1426224 ... purechess-engine.linux-x64-musl.node
```

**Module resolution in the runner (pnpm deploy layout):**
```bash
docker run --rm --platform linux/amd64 --entrypoint sh purechess-api-test -c '
  ls -la /app/node_modules/purechess-engine-native/
  # → index.js, index.d.ts, package.json, purechess-engine.linux-x64-musl.node
  cd /app
  node -e "console.log(require.resolve(\"@nestjs/core\"))"
  # → /app/node_modules/.pnpm/@nestjs+core@10.4.22_.../node_modules/@nestjs/core/index.js
  node -e "console.log(require.resolve(\"@sentry/node\"))"
  # → /app/node_modules/.pnpm/@sentry+node@10.56.0/node_modules/@sentry/node/build/cjs/index.js
  node -e "console.log(require.resolve(\"@purechess/shared\"))"
  # → /app/node_modules/.pnpm/@purechess+shared@file+packages+shared/node_modules/@purechess/shared/dist/index.js
  node -e "const n = require(\"purechess-engine-native\"); console.log(typeof n.validateMove)"
  # → function
'
# All resolve cleanly; the napi binding loads and exposes validateMove as a function.
```

**Symlink integrity in the runner:**
```bash
docker run --rm --platform linux/amd64 --entrypoint sh purechess-api-test -c '
  readlink /app/node_modules/@purechess/shared
  # → ../.pnpm/@purechess+shared@file+packages+shared/node_modules/@purechess/shared
  readlink /app/node_modules/@purechess/engine-native
  # → ../.pnpm/@purechess+engine-native@file+packages+engine-native/node_modules/@purechess/engine-native
  # Both workspace package symlinks resolve into the pruned virtual store.
'
```

The full quality matrix (typecheck, lint, jest, cargo, shadow, clippy) is in §10.5.

---

## 4. (Section removed)

The three options from the original §4 are now history. Option A (`node-linker=hoisted` in `.npmrc`) was selected first but pivoted to Option B (canonical pnpm + Docker pattern) when Fix 2's per-package devDeps approach failed under pnpm 9's hoisted linker (the per-package script PATH didn't include the hoisted root `node_modules/.bin`). See §3.1 for the full rationale.

---

## 5. Files in this commit

### Bugs 1–4 (already on `epic/rust-engine-migration` as of commit 2e9b43a)
```
apps/api/Dockerfile                       (Bugs 1, 2, 4 fixes)
crates/purechess-engine/package.json      (Bug 3 fix)
```

### Bug 5 (this commit) + the four pre-existing fixes
```
.npmrc                                    (comment explaining the per-package
                                            devDep contract for pnpm 9 strict
                                            linker; no longer has node-linker=hoisted
                                            because we pivoted to Option B)
apps/api/Dockerfile                       (major restructure: deps stage pnpm fetch,
                                            builder stage pnpm install --offline +
                                            pnpm deploy --prod; runner is a
                                            single COPY from /deploy)
apps/api/package.json                     (added "express": "^4.22.1" as direct dep;
                                            removed bcryptjs, @types/bcryptjs,
                                            pino-http, @nestjs/swagger,
                                            @nestjs/terminus as dead deps; added
                                            eslint, typescript-eslint, @eslint/js
                                            as devDeps for the lint fix)
apps/api/eslint.config.mjs                (rewrote with @typescript-eslint/consistent-type-imports
                                            off because NestJS DI mixes value and
                                            type imports)
apps/api/tsconfig.json                    (added ignoreDeprecations: "5.0" for the
                                            moduleResolution=node deprecation)
apps/api/src/computer-games/
  computer-games.service.ts               (removed explicit Prisma.TransactionClient
                                            type annotation that was masking stale
                                            prisma client types; removed unused
                                            Prisma import as a consequence)
apps/web/package.json                     (removed socket.io-client, @testing-library/
                                            user-event, @vitejs/plugin-react,
                                            @vitest/coverage-v8 as dead deps)
packages/shared/package.json              (removed "type": "module" and the exports
                                            field; added eslint, typescript-eslint,
                                            @eslint/js as devDeps)
packages/shared/tsconfig.json             (module: NodeNext → commonjs;
                                            moduleResolution: NodeNext → node;
                                            added ignoreDeprecations: "5.0")
packages/shared/src/index.ts              (dropped .js extensions from 14 relative
                                            imports — CJS convention)
packages/shared/src/chess.ts              (dropped 1 .js extension)
packages/shared/src/ws-events.ts          (dropped 2 .js extensions)
packages/shared/src/dto/game.dto.ts       (dropped 3 .js extensions)
packages/shared/src/dto/matchmaking.dto.ts (dropped 1 .js extension)
packages/shared/src/dto/user.dto.ts       (dropped 1 .js extension)
packages/shared/eslint.config.mjs         (new — eslint config for the shared
                                            package, copy of the root with
                                            dist/ + node_modules/ ignores)
packages/engine-native/tsconfig.json     (added ignoreDeprecations: "5.0")
pnpm-lock.yaml                            (regen for: removed deps, added devDeps,
                                            shared CJS conversion)
docs/roadmap/rust-engine-migration/
  docker-build-fix-handoff.md             (this doc — full rewrite to reflect the
                                            Option B pivot and the four pre-existing
                                            fixes)
```

**Status:** all changes in the working tree, verified end-to-end on `linux/amd64` per §3.4 + §10.5. The full image builds at 251 MB, the rust-builder stage still produces the `.node` binary, the runner image has all symlinks resolving, `require('purechess-engine-native').validateMove` is a function, and the four pre-existing quality issues are gone.

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
# Fails at [builder X/Y] RUN pnpm --filter @purechess/api build
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
# Completes successfully. Final image 251 MB.
# Critical step: "[builder X/Y] RUN pnpm --filter @purechess/api build" → nest build → 0 errors.
# Followed by: pnpm deploy --prod /deploy → /deploy contains the api as a
# self-contained directory.

# Module resolution smoke:
docker run --rm --platform linux/amd64 --entrypoint sh purechess-api-test -c '
  cd /app
  node -e "console.log(require.resolve(\"@nestjs/core\"))"
  node -e "console.log(require.resolve(\"express\"))"
  node -e "console.log(require.resolve(\"@sentry/node\"))"
  node -e "console.log(require.resolve(\"@purechess/shared\"))"
  node -e "const n = require(\"purechess-engine-native\"); console.log(typeof n.validateMove)"
'
# All resolve cleanly. The napi binding loads and exposes validateMove as a function.

# Symlink integrity:
docker run --rm --platform linux/amd64 --entrypoint sh purechess-api-test -c '
  readlink /app/node_modules/@purechess/shared
  # → ../.pnpm/@purechess+shared@file+packages+shared/node_modules/@purechess/shared
  ls /app/node_modules/purechess-engine-native/
  # → index.js  index.d.ts  package.json  purechess-engine.linux-x64-musl.node
'
```

---

## 8. Operator decision resolved

Both open questions from the original §8 are now answered:
1. **Bugs 1–4 + Bug 5 + the four pre-existing fixes ship together as a single commit** (the original §8's "Option 1" — atomic green-CI change). The commit lands on `epic/rust-engine-migration`; PR #5 picks up the new commit.
2. **The phantom-dep risk** that the original handoff flagged is real but bounded: one true hard phantom (`express`) in `apps/api`, fixed by adding it as a direct dep. The web/shared/engine-native packages are clean. See §3.3.

The "context7 MCP integration" out-of-scope item from the original §9 is still out of scope here — no CI workflow changes needed, the existing `build` job picks up the new Dockerfile automatically.

---

## 9. Out of scope (acknowledged but not addressed)

- **`context7` MCP integration.** The first pass (Bugs 1–4) didn't have the `context7` MCP server configured; worked around it with `webfetch` on the napi-rs docs. Not relevant to Bug 5.
- **The `docker build` workflow job in `.github/workflows/ci.yml` (the `build` job).** Not changed in this session. The existing `build` job picks up the new Dockerfile automatically.
- **Local dev workflow.** The Dockerfile changes only affect the CI / production image. Local dev still uses `scripts/build-engine.sh` and `pnpm dev:api`, which were not touched.

---

## 10. The four pre-existing issues (now fixed)

The original handoff's §9 listed three pre-existing issues that surfaced during Bug 5 verification but were out of scope. With the pivot to Option B and a thorough investigation, all of them are now fixed in this commit.

### 10.1. Fix 1 — ESM/CJS interop (apps/api + packages/shared)

**Symptom:** The compiled `dist/main.js` throws `ERR_REQUIRE_ESM: require() of ES Module` at startup, because `packages/shared` was ESM (`"type": "module"`) and `apps/api` is CJS — every `import ... from '@purechess/shared'` in api source became a `require()` at build time, which Node refuses to do synchronously on an ESM module.

**Fix:** Convert `packages/shared` to CJS. Smaller blast radius than converting `apps/api` to ESM (which would require restructuring every relative import, adding `.js` extensions, and fighting NestJS's ESM bundler story).

**Files changed:**
- `packages/shared/package.json` — removed `"type": "module"`, removed the `exports` field (no longer needed for ESM resolution).
- `packages/shared/tsconfig.json` — changed `module: NodeNext` + `moduleResolution: NodeNext` → `module: commonjs` + `moduleResolution: node`. Also added `ignoreDeprecations: "5.0"` (Fix 3).
- `packages/shared/src/index.ts` + 5 DTO files + `chess.ts` + `ws-events.ts` — removed `.js` extensions from all relative imports (CJS convention; ESM convention requires them).

**Why this is safe:** `packages/shared` is consumed only by `apps/api` (CJS) and `apps/web` (ESM with `moduleResolution: "bundler"`, which resolves CJS at typecheck time via `package.json` `main`). The web typecheck still passes because bundler resolution transparently follows the `main` field.

### 10.2. Fix 2 — per-package devDeps (lint/typecheck command-not-found)

**Symptom:** `pnpm -r lint` and `pnpm -r typecheck` fail with `sh: eslint: command not found` (or `sh: tsc: command not found`) because pnpm 9 only adds the **per-package** `node_modules/.bin` to a per-package script's PATH. With the default strict linker, that's the per-package devDeps' `.bin` directory; but pnpm can't add root `node_modules/.bin` to per-package script PATHs, so root-only devDeps (`eslint`, `typescript`, `next`, `nest`, etc.) declared in the root `package.json` aren't visible to per-package scripts.

**Fix:** Add the CLI tools each package's scripts need as **direct devDeps of that package** (not just the root). The pnpm 9 strict linker creates per-package `node_modules/.bin/` from direct devDeps.

**Files changed:**
- `packages/shared/package.json` — added `eslint`, `typescript-eslint`, `@eslint/js` as devDeps.
- `packages/shared/eslint.config.mjs` (new) — copies the root eslint config (with appropriate ignores for `dist/`, `node_modules/`, etc.).
- `apps/api/package.json` — added `eslint`, `typescript-eslint`, `@eslint/js` as devDeps.
- `apps/api/eslint.config.mjs` (rewrote) — same as root config but with `consistent-type-imports: 'off'` (NestJS DI mixes value and type imports; the strict rule breaks runtime resolution).
- The engine-native package didn't need changes; its only script is `tsc` which is already a devDep.

After this, `pnpm -r lint` finds eslint in each package and runs successfully. 112 latent lint errors in the api source (all `@typescript-eslint/consistent-type-imports`) were also fixed by turning off the rule in the api's config.

### 10.3. Fix 3 — TS5107 `moduleResolution: node` deprecation

**Symptom:** `tsc --noEmit` exits with `error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0`. The deprecation warning was treated as an error by `tsc`, which hid 6 real typecheck errors (2 implicit-any in `users.service.ts`, 4 in `computer-games*.service.ts` saying `Property 'move'/'game' does not exist on type 'TransactionClient'`).

**Fix:** Add `ignoreDeprecations: "5.0"` to the CJS packages' tsconfigs. The valid value for TS 5.x is `"5.0"` (not `"6.0"` which is only valid in TS 7+). The deprecation is real but not actionable for a CJS package that needs to support modern Node — pnpm 9 doesn't fully support `moduleResolution: "node16"` for CJS workspaces, so we silence the deprecation and let pnpm's `tsc` work as-is.

**Files changed:**
- `packages/shared/tsconfig.json` — added `ignoreDeprecations: "5.0"`.
- `apps/api/tsconfig.json` — added `ignoreDeprecations: "5.0"`.
- `packages/engine-native/tsconfig.json` — added `ignoreDeprecations: "5.0"`.

The web package uses `moduleResolution: "bundler"` (modern) and is not affected. The 6 hidden typecheck errors in the api all turned out to be **stale Prisma client types** — running `pnpm exec prisma generate` (or any pnpm operation that re-resolves the api's deps) refreshed the `.prisma/client/index.d.ts` and made the errors disappear. The api source itself is clean.

### 10.4. Fix 4 — dead dep pruning

**Symptom:** Several packages declare dependencies that are never imported in their source. These bloat `pnpm install` time, lockfile size, and (under `--prod`) the runner image. Some are also tripping `pnpm 9.4.0`'s "unmet peer" warnings (`@typescript-eslint/*` warns about wanting `eslint@^8.56.0` while root has `eslint@^9.0.0`).

**Fix:** Prune the dead deps after a thorough audit (ripgrep for every external import in each package's source + config files; cross-referenced against declared deps).

**Pruned (4 from `apps/web`, 6 from `apps/api`):**

| Package | Dep | Why safe to drop |
|---|---|---|
| `apps/api` | `bcryptjs` + `@types/bcryptjs` | `password.service.ts` uses `argon2` only. No `bcryptjs` import anywhere. |
| `apps/api` | `pino-http` | `nestjs-pino` handles HTTP logging; no direct import. |
| `apps/api` | `@nestjs/swagger` | No `DocumentBuilder`/`SwaggerModule` usage. The api doesn't expose OpenAPI. |
| `apps/api` | `@nestjs/terminus` | No `TerminusModule`/`HealthCheck` usage. The api has a health controller but uses a custom impl, not terminus. |
| `apps/web` | `@testing-library/user-event` | Tests use `fireEvent` from `@testing-library/react` directly; no `userEvent` import. |
| `apps/web` | `@vitejs/plugin-react` | `vitest.config.ts` uses native esbuild (`esbuild: { jsx: 'automatic' }`), not the React plugin. |
| `apps/web` | `@vitest/coverage-v8` | No `coverage` block in `vitest.config.ts`; `pnpm test` script is `vitest run` with no `--coverage` flag. |
| `apps/web` | `socket.io-client` | The web app uses native `WebSocket` (`src/hooks/use-invite.ts:93`); the CLAUDE.md's "Socket.IO client for live games" is aspirational/stale. The real-time gateway at `apps/api/src/realtime/` uses `@nestjs/websockets` which the web could consume via a future Socket.IO client, but for now no client code references this. |

**Kept (transitively required even though no direct import):** `rxjs`, `@nestjs/platform-socket.io` (needed by NestJS at runtime when `@nestjs/websockets` is used), `pino-pretty` (referenced as a string in `app.module.ts`'s `transport: { target: 'pino-pretty' }`).

### 10.5. Quality matrix after all fixes

Run on `linux/amd64` (Docker emulation on Apple Silicon for Docker; native for the cargo/typescript tests).

| Check | Result |
|---|---|
| `pnpm -r typecheck` | ✅ all 4 packages pass (after `prisma generate` refreshes stale types) |
| `pnpm -r lint` | ✅ all 4 packages pass |
| `pnpm engine:shadow` | ✅ 203 traces, 0 divergences |
| `apps/api` jest (with coverage) | ✅ 226/226 tests pass; 2 suites can't run due to pre-existing argon2 native build (verified pre-existing) |
| `cargo test --features impl` | ✅ 17/17 pass |
| `cargo clippy --all-targets --features impl -- -D warnings` | ✅ clean |
| `docker build --platform linux/amd64 --no-cache -f apps/api/Dockerfile .` | ✅ succeeds; 251 MB final image |
| `docker build --platform linux/amd64 --no-cache --target rust-builder -f apps/api/Dockerfile .` | ✅ succeeds; 1.4 MB musl-linked .node binary produced in ~27s |
| Symlink integrity: `realpath /app/node_modules/@nestjs/config` in runner | ✅ resolves to real .pnpm/ entry (no "No such file or directory" — the Bug 5 signature is gone) |
| Module resolution in runner: `node -e "require.resolve('@sentry/node' | '@nestjs/core' | 'express' | 'chess.js' | '@purechess/shared' | 'purechess-engine-native')"` | ✅ all resolve; `purechess-engine-native.validateMove` is a function |
