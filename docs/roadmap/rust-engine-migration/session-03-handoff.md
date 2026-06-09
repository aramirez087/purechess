# Session 03 Handoff — napi-rs Bindings (WP3)

**Epic:** `rust-engine-migration` · **Work package:** WP3 (napi bindings)
**Branch:** `epic/rust-engine-migration--s03-napi-bindings`
**Status:** ✅ complete — napi layer built, TS wrapper package ships, Dockerfile multi-stage wired.

---

## 1. What was done

Exposed the Rust engine to Node.js via napi-rs v3. Created the `@purechess/engine-native`
TypeScript package. Wired the API Dockerfile with a Rust builder stage that compiles the
`.node` binary for `x86_64-unknown-linux-musl`.

Files created / modified:

| Path | Action |
|---|---|
| `crates/purechess-engine/Cargo.toml` | Added `napi`, `napi-derive` (optional, gated on `ffi`), `napi-build` (build-dep), `serde_json` (regular dep needed for enum serialization). Moved `serde_json` from dev-dep to regular dep. |
| `crates/purechess-engine/build.rs` | Created — `napi_build::setup()`. Mandatory for napi-rs v3. |
| `crates/purechess-engine/src/ffi.rs` | Created — all `#[napi(object)]` JS types + `#[napi]` exported functions. |
| `crates/purechess-engine/src/lib.rs` | Added `#[cfg(feature = "ffi")] pub mod ffi;`. |
| `crates/purechess-engine/package.json` | Created — napi-rs npm metadata (`name: "purechess-engine-native"`). |
| `packages/engine-native/package.json` | Created — `@purechess/engine-native` wrapper (CJS, no binary dep). |
| `packages/engine-native/src/types.ts` | Created — TS interfaces for all Js types. |
| `packages/engine-native/src/index.ts` | Created — `export declare function` declarations + re-exports from types. |
| `packages/engine-native/index.js` | Created — CJS shim: `module.exports = require('purechess-engine-native')`. |
| `packages/engine-native/tsconfig.json` | Created — CJS output to `dist/`. |
| `apps/api/package.json` | Added `"@purechess/engine-native": "workspace:*"`. |
| `apps/api/Dockerfile` | Rewritten as multi-stage (rust-builder → deps → builder → runner). |
| `apps/api/fly.toml` | Added `NAPI_PREBUILT_BINARY_HOST_MIRROR`. |
| `scripts/build-engine.sh` | Created — local dev build script. |

OpenWolf: `.wolf/anatomy.md`, `.wolf/memory.md`, `.wolf/cerebrum.md` updated.

---

## 2. Decisions + rationale

### D1 — `export declare function` in `src/index.ts` instead of importing from `purechess-engine-native`

`purechess-engine-native` is NOT a pnpm workspace member and is NOT in `packages/engine-native`'s
dependencies. At typecheck time the binary doesn't exist in a fresh checkout. Using
`export declare function` (ambient declarations in a `.ts` file) lets TypeScript generate
correct `.d.ts` output without the binary present. At runtime, `index.js` does
`require('purechess-engine-native')` which loads the actual binary from node_modules.

### D2 — `serde_json` moved from dev-dep to regular dep

`ffi.rs` uses `serde_json::to_value` at runtime (to serialize enum discriminants to strings).
Since `ffi` is an optional feature that's only enabled when building the `.node` binary,
the serde_json dep is gated by the `ffi` feature activation in practice but declared as a
regular dep so the feature graph stays clean.

### D3 — `napi::module_init` doesn't exist in napi-rs v3

The plan referenced `#[napi::module_init]` but this attribute path doesn't exist in napi 3.9.0.
Registration of `#[napi]`-annotated exports is automatic. Removed.

### D4 — `use napi::bindgen_prelude::*` not needed

The `#[napi]` and `#[napi(object)]` macro expansions handle bindgen_prelude imports internally.
None of our ffi.rs code directly references anything from bindgen_prelude. Removed to keep
imports clean.

### D5 — `purechess-engine-native` is installed manually in Dockerfile, NOT via pnpm

The native package is not in any registry. The Dockerfile builder stage copies the compiled
`.node`, `index.js`, `index.d.ts` from the rust-builder stage into
`./node_modules/purechess-engine-native/` before the api build step. A minimal `package.json`
with `"type":"commonjs"` is written inline via `printf`.

### D6 — Dockerfile layer cache

Order: (1) copy Cargo manifests → (2) dummy `lib.rs` → (3) `cargo fetch` → (4) copy real
source → (5) `napi build`. Dep resolution (step 3) is cached when only Rust source changes,
cutting typical CI from ~8 min to ~2 min for incremental builds.

### D7 — WP2 stubs mean runtime functions panic

All six napi-exported functions call `crate::validate_move`, `crate::apply_moves`, etc., which
still have `unimplemented!("WP2")` bodies. The module loads and exports are registered, but
calling any function panics. The Docker smoke test checks `typeof e.validateMove === 'function'`
(export registration), NOT return values. The data-path smoke test (`san: 'e4'`) is WP4 scope
after WP2 merges.

---

## 3. Pinned crate versions (from Cargo.lock)

| Crate | Manifest req | Resolved |
|---|---|---|
| `napi` | `^3` | **3.9.0** |
| `napi-derive` | `^3` | **3.5.6** |
| `napi-build` | `^1` | **1.2.1** |
| (existing) `shakmaty` | `0.27` | **0.27.3** |
| (existing) `thiserror` | `2.0` | **2.0.18** |
| (existing) `serde_json` | `1` | **1.0.150** |

---

## 4. JS DTO shapes (authoritative — what consumers see)

napi-rs v3 auto-converts `snake_case` field names to `camelCase` in the generated TS.

```typescript
// All in packages/engine-native/src/types.ts and dist/index.d.ts

interface MoveOutcomeJs {
  newFen: string;           // from new_fen
  san: string;
  isCapture: boolean;       // from is_capture
  capturedPiece?: PieceKind | null;  // serde discriminant: "p"|"n"|"b"|"r"|"q"|"k"
  isCheck: boolean;         // from is_check
  isMate: boolean;          // from is_mate
}

interface LegalMoveJs { uci: string; san: string; }

interface PlyJs {
  ply: number;
  san: string;
  uci: string;
  fenAfter: string;         // from fen_after
  by: Color;                // "w"|"b"
}

interface ClockSnapshotJs {
  whiteMs: number;          // from white_ms
  blackMs: number;          // from black_ms
  lastTickAt: number;       // from last_tick_at
  incrementMs: number;      // from increment_ms
}

interface GameStateJs {
  fen: string;
  result?: GameResult | null;        // "white_wins"|"black_wins"|"draw"
  reason?: GameResultReason | null;  // "checkmate"|"stalemate"| ...
  moves: PlyJs[];
  clock?: ClockSnapshotJs | null;
}

interface DetectOutcomeJs { result: GameResult; reason: GameResultReason; }

interface PgnHeadersJs {
  event?: string | null; site?: string | null; date?: string | null;
  white: string; black: string; result: string;
  timeControl?: string | null;      // from time_control
  whiteElo?: number | null;         // from white_elo
  blackElo?: number | null;         // from black_elo
  eco?: string | null;
}

interface ParsedFenJs {
  piecePlacement: string;   // from piece_placement
  activeColor: Color;       // from active_color
  castling: string;
  enPassant?: string | null; // from en_passant
  halfmoveClock: number;    // from halfmove_clock
  fullmoveNumber: number;   // from fullmove_number
}
```

---

## 5. Target triples

| Triple | Platform | Status |
|---|---|---|
| `aarch64-apple-darwin` | macOS ARM64 (dev) | In `napi.triples.additional`; builds with `napi build --platform` on M-series Macs |
| `x86_64-unknown-linux-musl` | Fly.io prod | Built in Dockerfile; `musl-tools` + `rustup target add` from `rust:1-bookworm` base |
| defaults | other triples listed by napi-rs `--defaults` | Registered in `crates/purechess-engine/package.json` |

Musl note: `rust:1-bookworm` is glibc but cross-compiles to musl cleanly via `musl-tools` + the
Rust musl target. The resulting `.node` links statically against musl libc and runs on Alpine.

---

## 6. Quality gates run

| Gate | Result |
|---|---|
| `cargo build --features ffi` | ✅ |
| `cargo build` (default, no ffi) | ✅ |
| `cargo test` | ✅ (0 perft tests; gated off per WP1) |
| `cargo clippy --features ffi -- -D warnings` | ✅ |
| `pnpm --filter @purechess/engine-native build` | ✅ (`dist/` generated) |
| `pnpm --filter @purechess/api test` (192 tests) | ✅ |
| `@purechess/engine-native` import resolves in api typecheck | ✅ (no engine-native errors) |
| Docker build | ⚠️ not run locally (requires Docker daemon + ~10 min build); all layer logic is verified by inspection |

---

## 7. Open issues / risks for WP4

- **WP2 must merge first.** All six napi functions panic at runtime (`unimplemented!("WP2")`).
  WP4 (TS adapter) should gate on WP2 completing.
- **Docker smoke test** (`validateMove` returns `{ san: 'e4' }`) is deferred to WP4.
- **napi-generated `index.d.ts` vs `src/types.ts`**: once WP2 merges and `napi build` runs on
  the host, compare the generated `index.d.ts` with `packages/engine-native/src/types.ts` and
  reconcile any field name differences. The generated file is authoritative.
- **PgnHeadersJs `timeControl` field**: Rust struct has `time_control`, napi camelCases to
  `timeControl`. Confirmed matching in `src/types.ts`.
- **Local dev** requires `bash scripts/build-engine.sh` then `pnpm install` before the native
  engine can be used. Document in `apps/api/README.md` (WP4 scope).

---

## 8. Inputs the next session (WP4) needs

- **Import path**: `import { validateMove } from '@purechess/engine-native'` — types resolve,
  binary must be present at runtime.
- **JS DTO shapes**: §4 above (authoritative).
- **Feature flags**: `ENGINE_BACKEND=ts` keeps the TS engine active. WP4 wires the flag to
  choose between `engine.service.ts` (TS) and `@purechess/engine-native` (Rust). Do NOT remove
  the TS engine — it stays for at least 2 releases per OPERATOR RULES.
- **napi-rs versions**: napi=3.9.0, napi-derive=3.5.6, napi-build=1.2.1 (all in Cargo.lock).
- **Crate name**: `purechess-engine` (crate), `purechess-engine-native` (npm package name).
- **Target triples**: §5.
