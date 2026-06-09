//! PureChess native engine — WP2 implementation.
//!
//! Stack: shakmaty (board repr, legal movegen, SAN/UCI/FEN, perft) + thiserror + arrayvec.
//! See README.md and docs/roadmap/rust-engine-migration/session-02-handoff.md.

// Default build forbids unsafe entirely. WP3's `ffi` feature relaxes this at the napi
// boundary only (Cargo lint tables can't be feature-conditional, so this lives here).
#![cfg_attr(not(feature = "ffi"), forbid(unsafe_code))]

pub mod error;
pub mod fen;
pub mod types;

mod board;
mod moves;
mod pgn;
mod result;

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
pub fn validate_move(fen: &str, uci: &str) -> Result<MoveOutcome, EngineError> {
    moves::validate_move_impl(fen, uci)
}

/// All legal moves in a position, each as UCI + SAN.
pub fn legal_moves(fen: &str) -> Result<Vec<LegalMove>, EngineError> {
    moves::legal_moves_impl(fen)
}

/// Apply a sequence of moves to a starting FEN, returning the resulting game state.
///
/// Preserves the `state.moves` semantics of game-state.ts: pure application appends one
/// `Ply` per legally-applied move and never flags on time (bug-005 path stays in the TS
/// service, which owns the clock). `clock` is `None` here.
pub fn apply_moves(fen: &str, ucis: &[&str]) -> Result<GameState, EngineError> {
    moves::apply_moves_impl(fen, ucis)
}

/// Detect a position-derivable termination. `Ok(None)` == ongoing.
///
/// In scope: Checkmate, Stalemate, InsufficientMaterial, FiftyMoveRule. OUT of scope here
/// (need history/clock, detected elsewhere): ThreefoldRepetition, Timeout. See handoff D4.
pub fn detect_result(fen: &str) -> Result<Option<DetectOutcome>, EngineError> {
    result::detect_result_impl(fen)
}

/// Serialize a game (starting FEN + UCI move list + headers) to PGN.
pub fn to_pgn(fen: &str, ucis: &[&str], headers: &PgnHeaders) -> Result<String, EngineError> {
    pgn::to_pgn_impl(fen, ucis, headers)
}

/// Count leaf nodes at a given depth from a position (perft).
#[cfg(feature = "impl")]
pub fn perft(fen: &str, depth: u32) -> Result<u64, EngineError> {
    let pos = board::fen_to_pos(fen)?;
    Ok(shakmaty::perft(&pos, depth))
}
