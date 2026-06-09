//! FEN parsing. Frozen WP1 surface — the inverse of fen-utils.ts#toFen, exposed so the
//! TS adapter (WP4) can diff-test FEN field-by-field.

use crate::error::EngineError;
use crate::types::Color;
use serde::{Deserialize, Serialize};

/// The six FEN fields, parsed. Mirrors the structure chess.js exposes, so WP4 can compare
/// each field independently against `fenPosition` / `halfmoveClock` / `toFen`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParsedFen {
    /// Field 1: piece placement, e.g. "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR".
    pub piece_placement: String,
    /// Field 2: side to move.
    pub active_color: Color,
    /// Field 3: castling availability, "KQkq" or "-".
    pub castling: String,
    /// Field 4: en-passant target square, e.g. "e3"; `None` for "-".
    pub en_passant: Option<String>,
    /// Field 5: halfmove clock (plies since last capture or pawn move).
    pub halfmove_clock: u32,
    /// Field 6: fullmove number (starts at 1).
    pub fullmove_number: u32,
}

/// Parse a FEN into its six fields. WP2 wires the real implementation.
pub fn parse(_fen: &str) -> Result<ParsedFen, EngineError> {
    unimplemented!("WP2")
}
