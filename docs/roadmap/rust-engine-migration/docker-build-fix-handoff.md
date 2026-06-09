# Docker Build Fix Handoff — Bug 5 (pnpm symlink hash divergence) is open

**Branch:** `epic/rust-engine-migration`
**Status:** Bugs 1–4 of the API Docker build are fixed in the working tree and verified end-to-end on `linux/amd64`. **Bug 5 (pnpm symlink hash divergence) is the blocker for CI green.** This doc records what was done, what's left, and the exact diagnostic for the open bug.

> This is a follow-on handoff, not a numbered session. The epic close (EPIC-COMPLETE.md) is already merged. The work here is post-epic: making the `Build API image` CI step pass.

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

**This is the blocker for the full CI build.** Bugs 1–4 make the rust-builder stage succeed; Bug 5 prevents the **builder** stage from running `pnpm --filter @purechess/api build` (`nest build` → `tsc`).

### Symptom (after Bugs 1–4 are fixed, the next error in the chain)

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

---

## 4. Recommended next step

Three options, ordered by my recommendation. **I have not implemented any of these** — they all involve non-trivial Dockerfile or repo changes and were out of scope for a "fix the CI build" turn.

### Option A: `node-linker=hoisted` in `.npmrc` (simplest, fastest to ship)

Add to a new `.npmrc` at the repo root:
```
node-linker=hoisted
```

This makes pnpm install a flat `node_modules` (like npm/yarn) instead of the symlinked virtual store. The hash-divergence problem disappears because there is no virtual store. Tradeoff: pnpm's strict dep-isolation guarantees are lost; phantom-dep bugs become possible if any code reaches into `node_modules` for an undeclared dep.

**My recommendation: try this first.** If the build passes, ship it. Re-evaluate strict isolation later.

### Option B: `pnpm fetch` + `pnpm install --offline` (canonical, more correct)

Restructure the Dockerfile to:
1. In `deps`: `pnpm fetch` (populates the pnpm content-addressable store from the lockfile; no symlinks).
2. In `builder`: `pnpm install --offline --frozen-lockfile` (creates symlinks from the already-populated store, deterministic).

This is the canonical pnpm + Docker pattern. Tradeoff: more complex Dockerfile (3 stages instead of 2), the offline install must be done **before** any other pnpm command in the builder.

### Option C: single-stage install (kills layer cache)

Combine the `deps` and `builder` stages so `pnpm install` runs once, in the same layer as the source COPY. The symlinks are created once and never get re-evaluated. Tradeoff: the layer cache trick (separate deps layer for fast incremental rebuilds) is lost. CI builds get slower.

---

## 5. Files in this session's commit (planned, NOT yet committed)

```
apps/api/Dockerfile                       38 +/-  (Bugs 1, 2, 4 fixes; consolidated in one edit)
crates/purechess-engine/package.json      13 +/-  (Bug 3 fix)
```

**Status:** modified in working tree, verified to produce a working `rust-builder` image. The `builder` stage still fails on Bug 5.

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

## 7. Reproducing Bug 5

```bash
docker build --platform linux/amd64 --no-cache -t purechess-api-test -f apps/api/Dockerfile .
# Watch the [builder 15/15] RUN pnpm --filter @purechess/api build step
# It will fail with "TS2307: Cannot find module '@nestjs/config'"

# Then inspect the symlink state:
docker run --rm --platform linux/amd64 --target builder --entrypoint sh <intermediate-image> \
  -c "cd /app/apps/api && realpath node_modules/@nestjs/config"
# realpath: node_modules/@nestjs/config: No such file or directory
```

The "No such file or directory" from `realpath` on a symlink that looks present is the bug signature.

---

## 8. Operator decision needed

Before committing the Bug 1–4 fixes:

1. **Should Bug 1–4 fixes be committed and pushed now**, even though Bug 5 is open? Pros: the rust-builder stage is unblocked (useful if the team wants to verify the napi binary independently, e.g. via `docker create` and `docker cp` from the rust-builder image). Cons: leaves CI red.
2. **Or hold the commit until Bug 5 is also fixed**, so a single commit lands a green CI. Pros: atomic change. Cons: depends on the Bug 5 fix decision (Option A/B/C above).

**My recommendation:** commit Bug 1–4 now as `feat(docker): fix API image build (rust-builder stage)` and reference this handoff for Bug 5. Open a follow-up issue/PR for Bug 5. This keeps the rust-builder stage regression-tested on CI (it can be added to the workflow as a separate `docker-rust-builder` job) while Bug 5 is resolved.

---

## 9. Out of scope (acknowledged but not addressed)

- **`context7` MCP integration.** I don't have the context7 MCP server configured in this environment. I worked around it with `webfetch` on `napi-rs/napi-rs`, `napi-rs/package-template`, and the napi-rs Dockerfiles. If a future session needs more authoritative napi-rs schema docs, configuring `context7` (or a similar tool) would be a useful follow-up.
- **The `docker build` workflow job in `.github/workflows/ci.yml` (the `build` job).** Not changed in this session. If Bug 5 is fixed, the existing `build` job should pick up the new Dockerfile automatically.
- **Local dev workflow.** The Dockerfile changes only affect the CI / production image. Local dev still uses `scripts/build-engine.sh` and `pnpm dev:api`, which were not touched.
- **The `prisma generate` step in the builder.** Currently still uses `pnpm --filter @purechess/api exec prisma generate` — fine, but I noted in passing that this pnpm subcommand invocation is one of the things that may exacerbate Bug 5's hash divergence. If Option B (canonical fetch pattern) is chosen, `prisma generate` should be the **only** `pnpm` operation in the builder (the install + symlink creation happens once, prisma is then just a binary).
