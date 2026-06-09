#!/usr/bin/env bash
# Build the purechess-engine native binary for the host platform.
# Run this before `pnpm dev` if you want to use the native engine locally.
# Output: prints the path to the built .node file.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CRATE_DIR="$REPO_ROOT/crates/purechess-engine"

cd "$CRATE_DIR"

if ! command -v napi &> /dev/null; then
  echo "[build-engine] @napi-rs/cli not found — installing locally..."
  npm install --ignore-scripts
fi

echo "[build-engine] Building native binary for host platform..."
npx napi build --platform --release --strip --features ffi

BUILT=$(find "$CRATE_DIR" -maxdepth 1 -name "purechess-engine.*.node" | head -1)
echo "[build-engine] Built: ${BUILT:-none found}"
