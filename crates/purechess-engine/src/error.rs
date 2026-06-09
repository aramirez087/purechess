//! Typed engine errors. Frozen WP1 contract — variants are part of the C-ABI surface
//! and must map 1:1 to the TS adapter's error translation (WP4).

use thiserror::Error;

/// All fallible engine functions return `Result<T, EngineError>`.
///
/// Variants are stable across the strangler migration. The napi layer (WP3) maps each
/// to a JS error code; the TS adapter (WP4) re-throws the existing engine error shapes.
#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum EngineError {
    /// FEN string failed to parse or describes an illegal position.
    #[error("invalid FEN: {0}")]
    InvalidFen(String),

    /// A move (UCI) is not legal in the given position.
    #[error("illegal move: {0}")]
    IllegalMove(String),

    /// A move could not be disambiguated (relevant for SAN parsing paths).
    #[error("ambiguous move: {0}")]
    AmbiguousMove(String),

    /// Catch-all for unexpected internal failures. Should be rare; never a control-flow path.
    #[error("internal: {0}")]
    Internal(String),
}
