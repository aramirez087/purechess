# Stage 0: Rust builder — compiles the napi .node binary for Linux musl.
FROM rust:1-bookworm AS rust-builder
RUN apt-get update && apt-get install -y musl-tools && rm -rf /var/lib/apt/lists/*
RUN rustup target add x86_64-unknown-linux-musl
RUN npm install -g @napi-rs/cli@^3.0.0

WORKDIR /build
# Layer-cache trick: copy Cargo manifests + lock first, create a dummy lib to allow
# `cargo fetch`, then overwrite with real source. Dep resolution is cached on src-only changes.
COPY Cargo.toml Cargo.lock ./
COPY crates/purechess-engine/Cargo.toml ./crates/purechess-engine/Cargo.toml
RUN mkdir -p crates/purechess-engine/src && \
    echo 'pub fn placeholder(){}' > crates/purechess-engine/src/lib.rs && \
    cargo fetch --target x86_64-unknown-linux-musl

COPY crates/purechess-engine ./crates/purechess-engine
WORKDIR /build/crates/purechess-engine
RUN npm install
RUN napi build --platform --release --strip \
      --target x86_64-unknown-linux-musl \
      --features ffi
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
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "dist/main.js"]
