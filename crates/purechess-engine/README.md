# purechess-engine

Native chess engine core for **PureChess**. This crate is the Rust replacement for the
TypeScript engine in `apps/api/src/chess/engine/`, exposed to the NestJS API via napi-rs
(WP3). It is part of the multi-year strangler epic `rust-engine-migration`.

> **WP1 status — frozen contract, no logic.** Every public function is a stub
> (`unimplemented!("WP2")`). This crate defines the *shape* WP2 (Rust impl) and WP3
> (napi-rs bindings) build against in parallel. Do not depend on runtime behavior yet.

## Stack

| Crate | Version | Role |
|---|---|---|
| [`shakmaty`](https://crates.io/crates/shakmaty) | `0.27` | Board representation, legal move generation, SAN/UCI/FEN, perft. Maintained by lichess; pure-Rust, builds on `aarch64-apple-darwin` and `x86_64-unknown-linux-musl`. |
| [`thiserror`](https://crates.io/crates/thiserror) | `2.0` | Typed `EngineError`. |
| [`arrayvec`](https://crates.io/crates/arrayvec) | `0.7` | Stack-allocated move lists. |
| [`serde`](https://crates.io/crates/serde) | `1` | Serialize result/value types; discriminants byte-match the TS enums. |

Dev-only: `serde_json` (fixture parsing), `proptest` (round-trip FEN tests, wired in WP2).

`shakmaty` was chosen over the brief's suggested `pleco` because our contract mandates SAN
(`MoveOutcome.san`, `LegalMove.san`), which shakmaty generates natively while pleco does not;
shakmaty is also actively maintained and portable to the Fly.io musl target. Rationale and
WP2 sign-off note: `docs/roadmap/rust-engine-migration/session-01-handoff.md`.

## Public API (frozen WP1 surface)

```rust
pub fn validate_move(fen: &str, uci: &str) -> Result<MoveOutcome, EngineError>;
pub fn legal_moves(fen: &str) -> Result<Vec<LegalMove>, EngineError>;
pub fn apply_moves(fen: &str, ucis: &[&str]) -> Result<GameState, EngineError>;
pub fn detect_result(fen: &str) -> Result<Option<DetectOutcome>, EngineError>;
pub fn to_pgn(fen: &str, ucis: &[&str], headers: &PgnHeaders) -> Result<String, EngineError>;
pub fn parse_fen(fen: &str) -> Result<ParsedFen, EngineError>;
```

Value types (`types.rs`): `MoveOutcome`, `LegalMove`, `GameState`, `Ply`, `ClockSnapshot`,
`DetectOutcome`, `PgnHeaders`, `Color`, `PieceKind`, `GameResult`, `GameTermination`
(`= GameResultReason`). Errors (`error.rs`): `EngineError { InvalidFen, IllegalMove,
AmbiguousMove, Internal }`. FEN (`fen.rs`): `ParsedFen` + `parse`.

Serde discriminants mirror the TypeScript enums exactly (`Color` → `"w"`/`"b"`,
`GameResult` → `"white_wins"`/`"black_wins"`/`"draw"`, etc.) so the napi/TS boundary sees
identical values.

## Features

| Feature | Default | Purpose |
|---|---|---|
| `impl` | off | WP2 enables it to compile real bodies + the perft test suite. |
| `ffi` | off | WP3 enables it to relax `forbid(unsafe_code)` at the napi boundary only. |

## Running

```sh
cargo build                                  # compiles stubs (this session)
cargo test                                   # WP1: runs 0 perft tests (suite gated on `impl`)
cargo test --features impl                   # WP2+: depth 1-3 perft (depth 4-5 are #[ignore]d)
cargo test --features impl -- --ignored      # deep perft (depth 4-5) — slow, WP5 parity suite
cargo clippy --all-targets -- -D warnings    # lint gate
cargo bench                                   # PLACEHOLDER — criterion benches land in WP5
```

## Perft fixtures

`tests/fixtures/perft_cases.json` carries the canonical perft tables (startpos, Kiwipete,
CPW Position 3 endgame, CPW Position 4 en-passant/castling stress) from the
[Chess Programming Wiki](https://www.chessprogramming.org/Perft_Results). These numbers match
Stockfish's published output; any mismatch in WP2 is a move-generation bug.
