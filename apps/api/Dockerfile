# Stage 0: Rust builder — compiles the napi .node binary for Linux musl.
# Use `rust:1-alpine` as the base: Alpine is musl-native, so the host target
# IS `x86_64-unknown-linux-musl` and no cross-compile toolchain is needed.
# The full musl toolchain (musl-dev, libgcc, crt1.o, Scrt1.o) is preinstalled.
# `rust:1-bookworm` was tried first but `musl-tools` on Debian only provides
# a `musl-gcc` wrapper, not the full musl sysroot (libgcc_s, libm, etc.) —
# static linking fails with "cannot find libgcc_s.so.1".
FROM rust:1-alpine AS rust-builder
# Install Node + the napi-rs CLI. The `nodejs` package on Alpine 3.23 is v24;
# it's only used to invoke the napi CLI at build time, not linked into the
# .node binary (which uses the napi ABI, not a specific Node version). The
# runtime image stays on `node:20.15.1-alpine`.
RUN apk add --no-cache nodejs npm
RUN npm install -g @napi-rs/cli@^3.0.0

WORKDIR /build
# Layer-cache trick: copy Cargo manifests + lock first, create dummy src + bench
# files so `cargo fetch` can parse the manifest, then overwrite with real source.
# Dep resolution is cached on src-only changes. cargo 1.93 validates bench paths
# even on `cargo fetch`, so a dummy benches/perft.rs is required alongside the
# dummy lib.rs.
COPY Cargo.toml Cargo.lock ./
COPY crates/purechess-engine/Cargo.toml ./crates/purechess-engine/Cargo.toml
RUN mkdir -p crates/purechess-engine/src crates/purechess-engine/benches && \
    echo 'pub fn placeholder(){}' > crates/purechess-engine/src/lib.rs && \
    echo 'fn main(){}' > crates/purechess-engine/benches/perft.rs && \
    cargo fetch

COPY crates/purechess-engine ./crates/purechess-engine
WORKDIR /build/crates/purechess-engine
RUN npm install
# Host is already x86_64-unknown-linux-musl (Alpine), so no cross-compile.
# The musl toolchain (libc.so, libgcc_s.so, crt1.o) is preinstalled at /usr/lib.
RUN napi build --platform --release --strip --features ffi
# Outputs: purechess-engine.linux-x64-musl.node, index.js, index.d.ts

# ── Node base ────────────────────────────────────────────────────────────────

FROM node:20.15.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate

# ── Deps: populate the pnpm virtual store from the lockfile ───────────────
#
# This stage populates the pnpm virtual store (node_modules/.pnpm/) from
# the lockfile via `pnpm fetch`. No per-package symlinks are created at
# this point — that happens in the `builder` stage via an `--offline`
# install. Splitting fetch from install is the canonical pnpm + Docker
# pattern: it produces deterministic symlink hashes in the builder (because
# pnpm's resolver never re-runs against the live registry) and avoids the
# peer-dep-hash divergence that occurred when `pnpm install` was run once
# in `deps` and then implicitly re-resolved by later pnpm invocations in
# `builder` (the original Bug 5).
#
# The deps stage fetches the ENTIRE lockfile (including devDeps of all
# workspace members) because the builder needs devDeps at compile time
# (typescript, nest CLI, prisma, etc.) and we cannot predict at fetch time
# which transitive devDeps the builder will need. The virtual store is
# then carried forward to the builder.

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine-native/package.json ./packages/engine-native/
RUN pnpm fetch

# ── Builder: create symlinks from the populated virtual store, then compile ─

FROM base AS builder
WORKDIR /app
# Carry the populated virtual store forward. Without this, the builder
# stage's `pnpm install --offline` would have no packages to draw from
# and would fail with ERR_PNPM_NO_OFFLINE_TARBALL for every package.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Full install (with devDeps) for the compile phase.
RUN pnpm install --offline --frozen-lockfile \
      --filter @purechess/api... \
      --filter @purechess/shared \
      --filter @purechess/engine-native

# Install the prebuilt native binary into apps/api/node_modules so the
# engine-native CJS shim can require it. This MUST happen before
# `pnpm deploy` so the binary gets included in the deployed directory.
RUN mkdir -p ./apps/api/node_modules/purechess-engine-native
COPY --from=rust-builder /build/crates/purechess-engine/index.js \
     ./apps/api/node_modules/purechess-engine-native/index.js
COPY --from=rust-builder /build/crates/purechess-engine/index.d.ts \
     ./apps/api/node_modules/purechess-engine-native/index.d.ts
COPY --from=rust-builder \
     /build/crates/purechess-engine/purechess-engine.linux-x64-musl.node \
     ./apps/api/node_modules/purechess-engine-native/purechess-engine.linux-x64-musl.node
RUN printf '{"name":"purechess-engine-native","version":"0.1.0","main":"index.js","type":"commonjs"}' \
    > ./apps/api/node_modules/purechess-engine-native/package.json

RUN pnpm --filter @purechess/shared build
RUN pnpm --filter @purechess/engine-native build
RUN pnpm --filter @purechess/api exec prisma generate
RUN pnpm --filter @purechess/api build

# Deploy the api as a self-contained directory with only its prod deps.
# `pnpm deploy` resolves the prod closure, copies the relevant subset of
# the virtual store, and lays out per-package node_modules with the right
# symlinks — all in one command.
RUN pnpm deploy --filter @purechess/api --prod /deploy

# Inject the prebuilt native binary into the deployed directory. We do
# this after `pnpm deploy` because the binary lives outside the pnpm
# workspace (it's built by the rust-builder stage) and is hand-rolled
# into apps/api/node_modules/purechess-engine-native/, which `pnpm deploy`
# doesn't know about.
RUN mkdir -p /deploy/node_modules/purechess-engine-native
COPY --from=rust-builder /build/crates/purechess-engine/index.js \
     /deploy/node_modules/purechess-engine-native/index.js
COPY --from=rust-builder /build/crates/purechess-engine/index.d.ts \
     /deploy/node_modules/purechess-engine-native/index.d.ts
COPY --from=rust-builder \
     /build/crates/purechess-engine/purechess-engine.linux-x64-musl.node \
     /deploy/node_modules/purechess-engine-native/purechess-engine.linux-x64-musl.node
RUN printf '{"name":"purechess-engine-native","version":"0.1.0","main":"index.js","type":"commonjs"}' \
    > /deploy/node_modules/purechess-engine-native/package.json

# ── Runner: minimal production image ────────────────────────────────────────

FROM node:20.15.1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# `pnpm deploy` already produced a self-contained directory at /deploy
# with only the api's prod deps, the pruned virtual store, and the
# workspace packages laid out at the right relative paths. Copy the
# whole thing in.
COPY --from=builder /deploy /app
WORKDIR /app
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/main.js"]
