# Session 01 Handoff — Rust Engine Contracts Charter (WP1)

**Epic:** `rust-engine-migration` · **Work package:** WP1 (contracts charter)
**Status:** ✅ complete — frozen spec, all functions stubbed, gates green.
**Downstream:** WP2 (Rust impl) and WP3 (napi-rs bindings) build in parallel against this.

This file is the **authoritative C-ABI contract**. Per OPERATOR RULES, any signature change
in WP2+ must update THIS doc and the matching tests in both languages simultaneously.

---

## 1. What was done

Created a new Rust workspace and the `purechess-engine` library crate with the **frozen
public API**, typed errors, value types, FEN parser stub, perft fixtures, and a gated perft
test suite. **No logic** — every function body is `unimplemented!("WP2")`. This is a pure
spec pass: `cargo test` compiles and runs zero perft assertions (suite gated behind the
`impl` feature, off by default).

Files created:

| Path | Purpose |
|---|---|
| `Cargo.toml` (repo root) | `[workspace]`, member `crates/purechess-engine`, `resolver="2"`, `[workspace.dependencies]`, `[workspace.lints.clippy]`. |
| `Cargo.lock` (repo root) | Committed — pins exact resolved versions (see §3). |
| `crates/purechess-engine/Cargo.toml` | Library crate, `crate-type=["cdylib","rlib"]`, `[features] impl, ffi`, lints. |
| `crates/purechess-engine/src/lib.rs` | Frozen 6-fn public surface + re-exports; `forbid(unsafe_code)` unless `ffi`. |
| `crates/purechess-engine/src/error.rs` | `EngineError` thiserror enum. |
| `crates/purechess-engine/src/types.rs` | All public value types + enums (serde discriminants match TS). |
| `crates/purechess-engine/src/fen.rs` | `ParsedFen` + `parse` stub. |
| `crates/purechess-engine/tests/perft.rs` | Per-position perft tests, gated `#[cfg(feature="impl")]`; depth 4-5 `#[ignore]`. |
| `crates/purechess-engine/tests/fixtures/perft_cases.json` | CPW perft tables (4 positions). |
| `crates/purechess-engine/README.md` | Stack, public API, run commands. |
| `docs/roadmap/rust-engine-migration/session-01-handoff.md` | This file. |

OpenWolf bookkeeping updated: `.wolf/anatomy.md`, `.wolf/memory.md`, `.wolf/cerebrum.md`
(Decision Log).

---

## 2. Decisions + rationale

### D1 — Crate stack: **shakmaty** (deviation from the brief's `pleco` — needs WP2 sign-off)

Chose `shakmaty` (lichess/`niklasf`) over the brief-recommended `pleco`. Reasons:

1. **Contract mandates SAN.** `MoveOutcome.san` / `LegalMove.san` are required. shakmaty
   generates + parses SAN natively (`shakmaty::san::{San, SanPlus}`); pleco has no SAN — we'd
   hand-roll disambiguation (the exact thing `AmbiguousMove` guards).
2. **FEN/UCI/perft first-class.** shakmaty ships `Fen`/`Epd`, `UciMove`, and `perft` matching
   Stockfish tables — directly serves `parse_fen`, UCI handling, and the perft suite.
3. **Maintenance + portability.** shakmaty `0.27.x` is current (2024+), pure-Rust, no C deps,
   builds clean on `aarch64-apple-darwin` (dev) and `x86_64-unknown-linux-musl` (Fly.io prod).
   pleco's last real release is ~2019 with old `rand`/`lazy_static` — a portability risk for a
   multi-year epic.
4. **No server search.** Computer games use client-side Stockfish (cerebrum); the API never
   searches. pleco's search/eval/TT machinery is dead weight. The brief's "shakmaty if we want
   our own eval later" caveat is moot — no server eval is planned.

**Switch cost ≈ 0** if WP2 rejects: only stubs + fixtures exist, no logic. Recorded in
`.wolf/cerebrum.md` Decision Log for explicit WP2 sign-off.

### D4 — `detect_result` signature change (ratified here)

Brief froze `detect_result(fen) -> Result<(GameResult, GameResultReason), EngineError>`. Not
expressible: (a) a bare FEN can't detect threefold (needs history) or timeout (needs clock);
(b) a tuple has no "ongoing" state, but TS `detectResult` returns `null` for ongoing games.

**Ratified signature:**
```rust
pub fn detect_result(fen: &str) -> Result<Option<DetectOutcome>, EngineError>;
// DetectOutcome { result: GameResult, reason: GameResultReason }
// Ok(None) == ongoing. In scope: Checkmate, Stalemate, InsufficientMaterial, FiftyMoveRule.
// OUT of scope (detected elsewhere): ThreefoldRepetition (needs history -> apply_moves),
//                                     Timeout (needs clock -> TS service layer).
```
WP4 diff-tests compare against TS `detectResult` for the position-derivable subset only.

### D5 — `GameState.result`/`reason` are `Option`

Ongoing games carry `None` (TS `null` parity). `apply_moves` takes **no clock input**, so it
never flags on time — it only appends legally-applied moves. bug-005 ("moves NOT appended on
flag-fall") is preserved because the pure engine never flags; the flag-fall path stays in the
TS service (`computer-games.service.ts`), which owns the clock. `GameState.clock` is `None`
from `apply_moves`; the service fills it.

### Other

- **GameResultReason** is a Rust `type` alias of `GameTermination` — ONE enum, matching the TS
  alias. Not a second type.
- **`unimplemented!("WP2")`** over `todo!()` for clearer intent.
- **`impl` feature gate** keeps WP1 a pure spec pass; WP2 flips it on.
- **`forbid(unsafe_code)`** via `#![cfg_attr(not(feature="ffi"), forbid(unsafe_code))]` in
  `lib.rs` (Cargo lint tables can't be feature-conditional). WP3's `ffi` feature relaxes it.
- **Clock-derived `Ply` fields** (`clockAfterMs`, `moveTimeMs` from `EngineMove`) are NOT in
  the Rust `Ply` — a pure engine can't compute them. They stay in the TS service.

---

## 3. Pinned crate versions (from committed `Cargo.lock`)

| Crate | Manifest req | Resolved (Cargo.lock) |
|---|---|---|
| `shakmaty` | `0.27` | **0.27.3** |
| `thiserror` | `2.0` | **2.0.18** |
| `arrayvec` | `0.7` | **0.7.6** |
| `serde` | `1` (derive) | **1.0.228** |
| `serde_json` (dev) | `1` | **1.0.150** |
| `proptest` (dev) | `1` | **1.11.0** |

Transitive of note: `bitflags 2.13.0`, `btoi 0.4.3`, `nohash-hasher 0.2.0` (shakmaty deps).
napi-rs crates (WP3) are NOT added yet — pin `napi`/`napi-derive` `^0.4`, `@napi-rs/cli`
`^3.0` per epic gotcha when WP3 starts. `criterion` deferred to WP5 (not added).

---

## 4. The frozen public Rust API — exact types WP2 must implement

```rust
// === error.rs ===
pub enum EngineError { InvalidFen(String), IllegalMove(String), AmbiguousMove(String), Internal(String) }

// === types.rs ===  (serde discriminants in comments == TS enum values)
pub enum Color { White /*"w"*/, Black /*"b"*/ }
pub enum PieceKind { Pawn/*"p"*/, Knight/*"n"*/, Bishop/*"b"*/, Rook/*"r"*/, Queen/*"q"*/, King/*"k"*/ }
pub enum GameResult { WhiteWins/*"white_wins"*/, BlackWins/*"black_wins"*/, Draw/*"draw"*/ }
pub enum GameTermination {
    Checkmate, Resignation, Timeout, Stalemate, InsufficientMaterial,
    ThreefoldRepetition, FiftyMoveRule, DrawAgreement, Abandonment,   // snake_case discriminants
}
pub type GameResultReason = GameTermination;

pub struct MoveOutcome { new_fen: String, san: String, is_capture: bool,
                         captured_piece: Option<PieceKind>, is_check: bool, is_mate: bool }
pub struct LegalMove { uci: String, san: String }
pub struct Ply { ply: u32, san: String, uci: String, fen_after: String, by: Color }
pub struct ClockSnapshot { white_ms: i64, black_ms: i64, last_tick_at: i64, increment_ms: i64 }
pub struct GameState { fen: String, result: Option<GameResult>, reason: Option<GameResultReason>,
                       moves: Vec<Ply>, clock: Option<ClockSnapshot> }
pub struct DetectOutcome { result: GameResult, reason: GameResultReason }
pub struct PgnHeaders { event: Option<String>, site: Option<String>, date: Option<String>,
                        white: String, black: String, result: String, time_control: Option<String>,
                        white_elo: Option<u32>, black_elo: Option<u32>, eco: Option<String> }

// === fen.rs ===
pub struct ParsedFen { piece_placement: String, active_color: Color, castling: String,
                       en_passant: Option<String>, halfmove_clock: u32, fullmove_number: u32 }
pub fn parse(fen: &str) -> Result<ParsedFen, EngineError>;            // re-exported as parse_fen

// === lib.rs — the 6 frozen functions (+ gated perft) ===
pub fn validate_move(fen: &str, uci: &str) -> Result<MoveOutcome, EngineError>;
pub fn legal_moves(fen: &str) -> Result<Vec<LegalMove>, EngineError>;
pub fn apply_moves(fen: &str, ucis: &[&str]) -> Result<GameState, EngineError>;
pub fn detect_result(fen: &str) -> Result<Option<DetectOutcome>, EngineError>;
pub fn to_pgn(fen: &str, ucis: &[&str], headers: &PgnHeaders) -> Result<String, EngineError>;
pub fn parse_fen(fen: &str) -> Result<ParsedFen, EngineError>;

#[cfg(feature = "impl")]
pub fn perft(fen: &str, depth: u32) -> Result<u64, EngineError>;     // WP2 wires; perft.rs calls it
```

**WP2 implementation list (exact fn names):** `validate_move`, `legal_moves`, `apply_moves`,
`detect_result`, `to_pgn`, `fen::parse` (= `parse_fen`), and `perft` (behind `impl`).

---

## 5. Perft fixtures — sources

`crates/purechess-engine/tests/fixtures/perft_cases.json`. Numbers are the canonical
[Chess Programming Wiki "Perft Results"](https://www.chessprogramming.org/Perft_Results)
tables (match Stockfish's published output).

| name | FEN | d1 / d2 / d3 / d4 / d5 |
|---|---|---|
| `startpos` | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | 20 / 400 / 8902 / 197281 / 4865609 |
| `kiwipete` (CPW Pos 2) | `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1` | 48 / 2039 / 97862 / 4085603 / 193690690 |
| `endgame` (CPW Pos 3) | `8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1` | 14 / 191 / 2812 / 43238 / 674624 |
| `ep_castle_stress` (CPW Pos 4) | `r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1` | 6 / 264 / 9467 / 422333 / 15833292 |

WP2: enable `impl`, implement `perft`, run `cargo test --features impl` (depth 1-3). Depth 4-5
are `#[ignore]`d (slow) — WP5 deep parity suite (`cargo test --features impl -- --ignored`).

---

## 6. Open questions deferred to WP2/WP4

- **Q1 (halfmove clock timing):** is the halfmove clock in `MoveOutcome.new_fen` updated
  before or after the move? chess.js increments **after**; WP2 must match. Add a diff test.
- **Q2 (timeout injection):** `apply_moves` takes no clock — flag-fall (bug-005) stays in the
  TS service for WP2. Revisit only if perf demands a future `apply_moves_timed(fen, ucis,
  clock, now)`. Recommend service-only.
- **Q3 (threefold history keying):** `apply_moves` must track its own FEN history (first-4-
  fields key per `fenPosition`) to detect threefold; confirm keying byte-matches
  `result-detector.ts`.
- **Q4 (SAN dialect):** must Rust SAN byte-match chess.js (`O-O`, `e8=Q+`, `Nbd7`, `#` for
  mate)? WP4 diff-test is the arbiter; shakmaty `SanPlus` is the candidate — verify glyphs.
- **Q5 (PGN numbering):** `pgn-builder.ts` emits `N...` prefix only for a leading black move,
  and a `result`-only output for an empty move list. `to_pgn` must reproduce both.
- **Q6 (en-passant capture):** ensure `captured_piece = Some(Pawn)` and `is_capture = true`
  for en passant (captured pawn is not on the `to` square).
- **Q7 (Rust coverage gate):** `cargo-llvm-cov` vs `cargo-tarpaulin` for the 90/85 equiv — WP5/CI.

---

## 7. Inputs the next session needs (explicit)

- **Crate name:** `purechess-engine` (path `crates/purechess-engine`). Public path for imports:
  `purechess_engine::*`.
- **Crates + versions:** §3 (committed in `Cargo.lock`). WP3 adds napi-rs (`napi`/`napi-derive`
  `^0.4`, `@napi-rs/cli` `^3.0`).
- **Function signatures + error/type shapes:** §4 (authoritative).
- **Target triples:** dev `aarch64-apple-darwin`, prod `x86_64-unknown-linux-musl` (Fly.io).
- **Features:** `impl` (WP2 turns on for logic + perft), `ffi` (WP3 turns on for napi unsafe).
- **Perft spec:** §5 — WP2 must pass depth 1-3 before WP4 begins.

---

## 8. Gates run (all green)

| Gate | Result |
|---|---|
| `cargo build` | ✅ clean (stubs compile) |
| `cargo test` | ✅ compiles; 0 perft run (suite gated off — pure spec pass) |
| `cargo clippy --all-targets -- -D warnings` | ✅ no warnings (also passes `--features impl`) |
| `cargo fmt --check` | ✅ clean |
| `pnpm -r typecheck` | ⚠️ pre-existing baseline reds only — see note |

**Typecheck note:** the only failures are **pre-existing, environment-bootstrap** errors NOT
introduced by this session (which touched zero TS): `@purechess/shared` is unbuilt (needs
`pnpm --filter @purechess/shared build`) and the Prisma client is ungenerated (needs
`apps/api` `pnpm db:generate`). No `apps/**` or `packages/**` files were modified.

**Coverage:** TS engine-dir gate (90/85) untouched (no TS changed). Rust coverage gate
(`cargo-llvm-cov`/tarpaulin, 90/85 equiv) is WP5/CI scope — see Q7.
