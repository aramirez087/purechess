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

# ── Deps: install Node dependencies ─────────────────────────────────────────

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/engine-native/package.json ./packages/engine-native/
RUN pnpm install --frozen-lockfile \
      --filter @purechess/api... \
      --filter @purechess/shared \
      --filter @purechess/engine-native

# ── Builder: compile apps ────────────────────────────────────────────────────

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/engine-native/node_modules ./packages/engine-native/node_modules
COPY . .

# Install the prebuilt native binary into node_modules so engine-native/index.js can load it.
RUN mkdir -p ./node_modules/purechess-engine-native
COPY --from=rust-builder /build/crates/purechess-engine/index.js \
     ./node_modules/purechess-engine-native/index.js
COPY --from=rust-builder /build/crates/purechess-engine/index.d.ts \
     ./node_modules/purechess-engine-native/index.d.ts
COPY --from=rust-builder \
     /build/crates/purechess-engine/purechess-engine.linux-x64-musl.node \
     ./node_modules/purechess-engine-native/purechess-engine.linux-x64-musl.node
RUN printf '{"name":"purechess-engine-native","version":"0.1.0","main":"index.js","type":"commonjs"}' \
    > ./node_modules/purechess-engine-native/package.json

RUN pnpm --filter @purechess/shared build
RUN pnpm --filter @purechess/engine-native build
RUN pnpm --filter @purechess/api exec prisma generate
RUN pnpm --filter @purechess/api build

# ── Runner: minimal production image ────────────────────────────────────────

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
