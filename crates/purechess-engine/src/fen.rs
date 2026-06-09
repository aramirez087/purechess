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

/// Parse a FEN into its six fields.
///
/// Validates the position by converting to a Chess position and re-serializes with
/// `EnPassantMode::Always` so the ep square matches chess.js output even when no legal
/// en-passant capture exists (D-S02-3).
pub fn parse(fen: &str) -> Result<ParsedFen, EngineError> {
    use crate::board;
    use shakmaty::{EnPassantMode, fen::Fen};

    // Validate by converting to a legal Chess position
    let pos = board::fen_to_pos(fen)?;

    // Serialize with EnPassantMode::Always to match chess.js FEN output
    let canonical = Fen::from_position(pos, EnPassantMode::Always).to_string();
    let parts: Vec<&str> = canonical.splitn(7, ' ').collect();

    if parts.len() < 6 {
        return Err(EngineError::InvalidFen(format!("malformed FEN: {fen}")));
    }

    let active_color = match parts[1] {
        "w" => Color::White,
        "b" => Color::Black,
        c => return Err(EngineError::InvalidFen(format!("bad color: {c}"))),
    };

    let en_passant = if parts[3] == "-" {
        None
    } else {
        Some(parts[3].to_string())
    };

    let halfmove_clock = parts[4]
        .parse::<u32>()
        .map_err(|_| EngineError::InvalidFen(format!("bad halfmove clock: {}", parts[4])))?;
    let fullmove_number = parts[5]
        .parse::<u32>()
        .map_err(|_| EngineError::InvalidFen(format!("bad fullmove number: {}", parts[5])))?;

    Ok(ParsedFen {
        piece_placement: parts[0].to_string(),
        active_color,
        castling: parts[2].to_string(),
        en_passant,
        halfmove_clock,
        fullmove_number,
    })
}
