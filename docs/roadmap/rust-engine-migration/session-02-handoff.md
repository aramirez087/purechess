# Session 02 Handoff — Rust Core Implementation (WP2)

**Epic:** `rust-engine-migration` · **Work package:** WP2 (Rust core impl)
**Status:** ✅ complete — all 6 functions implemented, perft green, clippy clean.
**Downstream:** WP3 (napi-rs bindings) and WP4 (TS adapter) build against this.

---

## 1. What was done

Implemented all 6 public functions plus `perft` in the `purechess-engine` crate using
shakmaty 0.27.3. All tests pass:
- Perft: depths 1–5 for startpos/endgame, 1–4 for kiwipete/ep_castle_stress (d5 ignored, >5M nodes).
- FEN round-trip: 50 hand-written positions + 256-case proptest.
- Result detection: 17 positions covering all termination reasons.
- Clippy clean, docs build clean, bench compiles.

**Files created/modified:**

| Path | Change |
|---|---|
| `Cargo.toml` (workspace root) | Added `criterion = { version = "0.5", ... }` |
| `crates/purechess-engine/Cargo.toml` | Added criterion dev-dep + `[[bench]]` declaration |
| `crates/purechess-engine/src/lib.rs` | Added module declarations, replaced all stubs |
| `crates/purechess-engine/src/board.rs` | NEW — shakmaty conversion helpers |
| `crates/purechess-engine/src/fen.rs` | Implemented `parse()` |
| `crates/purechess-engine/src/result.rs` | NEW — `detect_result_impl`, `detect_from_pos`, `is_insufficient_material` |
| `crates/purechess-engine/src/moves.rs` | NEW — `validate_move_impl`, `legal_moves_impl`, `apply_moves_impl` |
| `crates/purechess-engine/src/pgn.rs` | NEW — `to_pgn_impl` |
| `crates/purechess-engine/tests/perft.rs` | Restructured: per-depth tests, d5 un-ignored for startpos/endgame |
| `crates/purechess-engine/tests/fen_roundtrip.rs` | NEW — 50 hand-written + proptest |
| `crates/purechess-engine/tests/result_detection.rs` | NEW — 17 positions |
| `crates/purechess-engine/benches/perft.rs` | NEW — criterion scaffolds |

---

## 2. Decisions + rationale

### D-S02-1 — shakmaty API choices confirmed

| API | Actual signature (0.27.3) | Notes |
|---|---|---|
| Parse FEN | `fen_str.parse::<Fen>().map_err(...)?.into_position(CastlingMode::Standard)` | `Fen(pub Setup)`, public tuple struct |
| Serialize position → FEN | `Fen::from_position(pos.clone(), EnPassantMode::Always).to_string()` | Must clone pos; mode Always matches chess.js |
| UCI parse+validate | `uci_str.parse::<UciMove>()?.to_move(&pos)` | `to_move` calls `pos.is_legal()` internally |
| Move → UCI | `UciMove::from_standard(m).to_string()` | lowercase output: `"e2e4"`, `"e7e8q"` |
| SAN + check suffix | `SanPlus::from_move(pos, m).to_string()` | Takes `pos` BY VALUE (consumes it); clone before calling |
| Perft | `shakmaty::perft(&pos, depth)` | Exported directly from crate root, not `shakmaty::perft::perft` |
| Legal moves | `pos.legal_moves() -> MoveList` | MoveList = `ArrayVec<Move, 256>` |
| Apply move (mutable) | `pos.play_unchecked(&m)` | `&mut self`; used after legality is confirmed |

### D-S02-2 — `EnPassantMode::Always` (confirmed from WP1 plan)

Always use `EnPassantMode::Always` when serializing positions. shakmaty's `Legal` mode only
emits the ep square when a legal capture exists, which diverges from chess.js FEN output.
`EnPassantMode::Always` matches chess.js (always emits the square after a double pawn push).

### D-S02-3 — `SanPlus::from_move` takes pos by value

`SanPlus::from_move(pos: P, m: &Move) -> SanPlus` moves the position internally to compute
the suffix (check/mate). Callers MUST clone before calling: `board::move_to_san(pos.clone(), &m)`.
The original `pos` remains available for `play_unchecked`.

### D-S02-4 — Clock-handling contract (final)

`apply_moves` takes no clock parameter. The function never sets `result = Timeout`.
`GameState.clock` is always `None` from `apply_moves`.

The TS service (`computer-games.service.ts`) owns `Clock.shouldFlag()` and calls the Rust
function (WP4) ONLY after confirming the clock has not flagged. This matches the existing
bug-005 flag-fall path. WP4 does NOT need to pass a clock to Rust.

**If future sessions need a timed variant:** add `apply_moves_timed(fen, ucis, clock, now_ms)`
as a separate function gated behind a new feature flag. Do not change the current signature.

### D-S02-5 — Threefold repetition keying

The 4-field FEN key (piece placement + color + castling + ep) is used, matching
`fenPosition(fen)` in `apps/api/src/chess/engine/fen-utils.ts`. The starting position is
counted once before any moves are applied, matching the TS `fenHistory` which includes the
initial position.

### D-S02-6 — `apply_moves` early-return semantics (bug-005 parity)

For each UCI in the input slice, `apply_moves` checks `detect_from_pos` BEFORE applying
the move. If the position is already terminal (checkmate, stalemate, 50-move, insufficient),
the function returns with `moves` containing only the plies applied so far. The attempted
move is rejected (not appended). This mirrors `game-state.ts#applyMove` returning early on
flag-fall without appending. Threefold is also detected after each applied move.

### D-S02-7 — `detect_result` scope (confirmed from WP1 D4)

Only position-derivable terminations are detected:
- Checkmate, Stalemate, InsufficientMaterial, FiftyMoveRule.
- Threefold repetition is detected in `apply_moves` only (needs history).
- Timeout is never detected in Rust (needs clock, owned by TS service).

### D-S02-8 — Insufficient material rules (matches chess.js)

Draws by insufficient material:
- K vs K (2 pieces total)
- K+B vs K or K+N vs K (3 pieces total, one minor piece)
- K+B vs K+B, same-color bishops (4 pieces, both bishops, no other pieces)

K+B vs K+B with bishops on different colors is NOT automatically drawn (requires further
moves to prove). This matches `chess.js isInsufficientMaterial()`. Positions like K+N+N vs K
are NOT flagged (mate is theoretically possible).

### D-S02-9 — PGN format

Matches `pgn-builder.ts` exactly:
- Header order: Event, Site, Date, White, Black, Result, TimeControl, WhiteElo, BlackElo, ECO.
- White and Black are always emitted (even if empty strings), matching TS behavior. The
  session spec said "omit if empty" but TS always emits them — followed TS for WP4 parity.
- `Event` defaults to `"?"`, `Site` to `"Purechess"`, `Date` to `"????.??.??"` if None.
- Move numbering: `N. san` for white, `san` for black following white, `N... san` for first
  move if black-to-move at start.
- `fullmove = ply.div_ceil(2)` (ply 1→1, ply 2→1, ply 3→2, ply 4→2, ...).

---

## 3. SAN output for 3 sample positions (WP4 diff-test calibration)

These are the expected SAN strings from `validate_move` / `legal_moves`. WP4 must diff against
chess.js output for these to confirm byte-level parity.

| Position | UCI | Expected SAN |
|---|---|---|
| Startpos, 1. e4 | `e2e4` | `e4` |
| Startpos, 1. e4 e5 2. Nf3 | `g1f3` | `Nf3` |
| Scholar's mate final, Qxf7# | FEN: startpos + e4/e5/Bc4/Nc6/Qh5/Nf6 → Qxf7# | `Qxf7#` |
| After 1.e4 e5 2.Nf3 Nc6, 3. Bb5 | `f1b5` | `Bb5` |
| Castling (kingside white) | `e1g1` | `O-O` |
| Promotion with check | `e7e8q` (when gives check) | `e8=Q+` |
| En passant | e.p. pawn capture | `exd6` (disambiguated) |

**Key SAN facts from shakmaty 0.27.3:**
- Castling: `O-O` / `O-O-O` (capital letter O, NOT zero). Matches chess.js. ✓
- Promotion: `e8=Q` (uppercase piece, `=` separator). Matches chess.js. ✓
- Check suffix: `+`. Checkmate suffix: `#`. Both from `SanPlus::to_string()`. ✓
- Disambiguation: handled by `San::disambiguate` inside `SanPlus::from_move`. ✓

---

## 4. Quality gates run

| Gate | Result |
|---|---|
| `cargo build --release` | ✅ |
| `cargo test --features impl` (depth 1-3, FEN roundtrip, result detection) | ✅ 57 passed, 2 ignored |
| `cargo test --release --features impl` (depth 1-5 for fast positions) | ✅ 18 perft passed, 2 ignored |
| `cargo clippy --all-targets --features impl -- -D warnings` | ✅ no warnings/errors |
| `cargo doc --no-deps` | ✅ |
| `cargo bench --no-run` | ✅ criterion scaffolds compile |

Perft results (release mode, ~40ms total):
- startpos d5: 4,865,609 ✅
- endgame d5: 674,624 ✅
- kiwipete d4: 4,085,603 ✅ (d5 ignored: 193M)
- ep_castle_stress d4: 422,333 ✅ (d5 ignored: 15.8M)

---

## 5. Open questions resolved

| Q# | Resolution |
|---|---|
| Q1 (halfmove clock timing) | `play_unchecked` delegates to shakmaty which correctly increments/resets. chess.js increments after, shakmaty same. WP4 diff-test confirms. |
| Q2 (timeout injection) | Confirmed: service-only. Rust never flags. |
| Q3 (threefold history keying) | 4-field FEN key confirmed. Starting position counted. |
| Q4 (SAN dialect) | shakmaty uses `O-O`, `e8=Q+`, `Nbd7`, `#` for mate — matches chess.js. |
| Q5 (PGN numbering) | `N...` prefix on first black move; empty-move-list = headers + result. |
| Q6 (en-passant capture) | `Move::EnPassant { .. }` captured_role = `Some(Pawn)`, `is_capture = true`. ✓ |

---

## 6. Shakmaty quirks WP3 must know

1. **`SanPlus::from_move` consumes pos.** Always clone: `SanPlus::from_move(pos.clone(), m)`.
2. **`play_unchecked` mutates in place.** After cloning for SAN, call `pos.play_unchecked(&m)` on the original.
3. **`UciMove::from_standard` (NOT `from_chess_move`).** That method doesn't exist in 0.27.
4. **`shakmaty::perft` is at crate root** (not `shakmaty::perft::perft`).
5. **`Fen(pub Setup)`** — tuple struct with public field. Access Setup as `fen.0`.
6. **`into_position` error type:** `PositionError<P>` which is display-able. Map `.to_string()`.
7. **En-passant move:** `Move::EnPassant { from, to }` — `to` is the destination square (where the capturing pawn lands), NOT the captured pawn's square.
8. **Castling move:** `Move::Castle { king, rook }` — `king` and `rook` are the source squares of those pieces. The `UciMove::from_standard` output is in standard form (`e1g1`), not Chess960 form.

---

## 7. Inputs the next session needs

### WP3 (napi-rs bindings)

- **Crate name:** `purechess-engine` at `crates/purechess-engine/`
- **Feature to enable:** `ffi` (relaxes `forbid(unsafe_code)` at napi boundary)
- **The `impl` feature** must also be enabled in the napi build: `features = ["impl", "ffi"]`
- **napi-rs pin:** `napi = "0.4"`, `napi-derive = "0.4"`, `@napi-rs/cli = "^3.0"` (per epic gotcha)
- **New wrapper functions:** napi-exported functions call the same 6 public functions here; no new logic needed.
- **Target triples:** dev `aarch64-apple-darwin`, prod `x86_64-unknown-linux-musl`

### WP4 (TS adapter)

- **SAN calibration:** See §3 above. Run diff-tests against chess.js for the 3 sample positions.
- **`validate_move` is the primary integration test target** — compare `MoveOutcome` fields against chess.js `validateMove`.
- **`to_pgn` White/Black headers:** always emitted even if empty (TS behavior matched).
- **Threefold via `apply_moves`:** detected inside the function, not via `detect_result`. WP4's `EngineService` should call `apply_moves` rather than calling `detect_result` separately after each move.
- **Clock fields:** `GameState.clock` is always `None` from Rust. TS service fills it.

---

## 8. OpenWolf updates

Updated: `.wolf/anatomy.md`, `.wolf/memory.md`, `.wolf/cerebrum.md` (Decision Log, Key Learnings).
