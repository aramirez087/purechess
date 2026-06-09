//! PureChess native engine — frozen WP1 contract.
//!
//! This crate is the single source of truth for the C-ABI surface that WP2 (Rust impl)
//! and WP3 (napi-rs bindings) build against in parallel. Every function here is a stub
//! (`unimplemented!("WP2")`); the SHAPE is the deliverable, not the logic.
//!
//! Stack: shakmaty (board repr, legal movegen, SAN/UCI/FEN, perft) + thiserror + arrayvec.
//! See README.md and docs/roadmap/rust-engine-migration/session-01-handoff.md.
//!
//! Two principled deviations from the WP1 brief's literal signatures, ratified in the
//! handoff:
//!   - D4: `detect_result` returns `Result<Option<DetectOutcome>>` (TS `null`/ongoing
//!     parity), not a bare `(GameResult, GameResultReason)` tuple.
//!   - D5: `GameState.result`/`reason` are `Option` (ongoing-game parity).

// Default build forbids unsafe entirely. WP3's `ffi` feature relaxes this at the napi
// boundary only (Cargo lint tables can't be feature-conditional, so this lives here).
#![cfg_attr(not(feature = "ffi"), forbid(unsafe_code))]

pub mod error;
pub mod fen;
pub mod types;

pub use error::EngineError;
pub use fen::{parse as parse_fen, ParsedFen};
pub use types::{
    ClockSnapshot, Color, DetectOutcome, GameResult, GameResultReason, GameState, GameTermination,
    LegalMove, MoveOutcome, PgnHeaders, PieceKind, Ply,
};

/// Validate a single move (UCI) against a FEN and return its outcome.
///
/// `Err(IllegalMove)` if the move is not legal in the position; `Err(InvalidFen)` if the
/// FEN does not parse.
pub fn validate_move(_fen: &str, _uci: &str) -> Result<MoveOutcome, EngineError> {
    unimplemented!("WP2")
}

/// All legal moves in a position, each as UCI + SAN.
pub fn legal_moves(_fen: &str) -> Result<Vec<LegalMove>, EngineError> {
    unimplemented!("WP2")
}

/// Apply a sequence of moves to a starting FEN, returning the resulting game state.
///
/// Preserves the `state.moves` semantics of game-state.ts: pure application appends one
/// `Ply` per legally-applied move and never flags on time (bug-005 path stays in the TS
/// service, which owns the clock). `clock` is `None` here.
pub fn apply_moves(_fen: &str, _ucis: &[&str]) -> Result<GameState, EngineError> {
    unimplemented!("WP2")
}

/// Detect a position-derivable termination. `Ok(None)` == ongoing.
///
/// In scope: Checkmate, Stalemate, InsufficientMaterial, FiftyMoveRule. OUT of scope here
/// (need history/clock, detected elsewhere): ThreefoldRepetition, Timeout. See handoff D4.
pub fn detect_result(_fen: &str) -> Result<Option<DetectOutcome>, EngineError> {
    unimplemented!("WP2")
}

/// Serialize a game (starting FEN + UCI move list + headers) to PGN.
pub fn to_pgn(_fen: &str, _ucis: &[&str], _headers: &PgnHeaders) -> Result<String, EngineError> {
    unimplemented!("WP2")
}

/// Count leaf nodes at a given depth from a position (perft). WP2 wires the real impl
/// behind the `impl` feature; the perft test suite (tests/perft.rs) is gated on it.
#[cfg(feature = "impl")]
pub fn perft(_fen: &str, _depth: u32) -> Result<u64, EngineError> {
    unimplemented!("WP2")
}
