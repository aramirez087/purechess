//! Public value types for the engine contract. Frozen WP1 surface.
//!
//! Every type that crosses the C-ABI boundary lives here and is re-exported from `lib.rs`.
//! Serde discriminants MUST byte-match the TypeScript enums so the napi JSON / TS adapter
//! sees identical values:
//!   - `Color`           -> "w" | "b"                (packages/shared/src/chess.ts Color)
//!   - `PieceKind`       -> "p" | "n" | "b" | "r" | "q" | "k"
//!   - `GameResult`      -> "white_wins" | "black_wins" | "draw"   (game-result.ts)
//!   - `GameTermination` -> exact GameTermination discriminants     (game-result.ts)

use serde::{Deserialize, Serialize};

/// Side to move / piece owner. Serializes to the TS `Color` union ("w" | "b").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Color {
    #[serde(rename = "w")]
    White,
    #[serde(rename = "b")]
    Black,
}

/// Piece type. Serializes to the TS `PieceType` union (lowercase SAN letters).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PieceKind {
    #[serde(rename = "p")]
    Pawn,
    #[serde(rename = "n")]
    Knight,
    #[serde(rename = "b")]
    Bishop,
    #[serde(rename = "r")]
    Rook,
    #[serde(rename = "q")]
    Queen,
    #[serde(rename = "k")]
    King,
}

/// Game outcome. Mirrors `GameResult` in packages/shared/src/game-result.ts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameResult {
    #[serde(rename = "white_wins")]
    WhiteWins,
    #[serde(rename = "black_wins")]
    BlackWins,
    #[serde(rename = "draw")]
    Draw,
}

/// Reason a game terminated. Mirrors `GameTermination` in game-result.ts EXACTLY.
/// `GameResultReason` is a TS alias of this enum, not a second type — see the alias below.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameTermination {
    #[serde(rename = "checkmate")]
    Checkmate,
    #[serde(rename = "resignation")]
    Resignation,
    #[serde(rename = "timeout")]
    Timeout,
    #[serde(rename = "stalemate")]
    Stalemate,
    #[serde(rename = "insufficient_material")]
    InsufficientMaterial,
    #[serde(rename = "threefold_repetition")]
    ThreefoldRepetition,
    #[serde(rename = "fifty_move_rule")]
    FiftyMoveRule,
    #[serde(rename = "draw_agreement")]
    DrawAgreement,
    #[serde(rename = "abandonment")]
    Abandonment,
}

/// TS alias parity: `GameResultReason = GameTermination`. ONE enum, two names.
pub type GameResultReason = GameTermination;

/// Result of validating + applying a single move against a FEN. (`validate_move`)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MoveOutcome {
    pub new_fen: String,
    pub san: String,
    pub is_capture: bool,
    pub captured_piece: Option<PieceKind>,
    pub is_check: bool,
    pub is_mate: bool,
}

/// One legal move in a position, both notations. (`legal_moves`)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LegalMove {
    pub uci: String,
    pub san: String,
}

/// A single played ply. Mirrors the position-derivable subset of `EngineMove` (chess.ts).
/// Clock-derived fields (`clockAfterMs`, `moveTimeMs`) are NOT computable by a pure engine
/// and stay in the TS service layer — see the handoff Open Questions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ply {
    pub ply: u32,
    pub san: String,
    pub uci: String,
    pub fen_after: String,
    pub by: Color,
}

/// Clock snapshot. Mirrors `ClockSnapshot` (clock.ts); ms values are i64 (JS serializes as number).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClockSnapshot {
    pub white_ms: i64,
    pub black_ms: i64,
    pub last_tick_at: i64,
    pub increment_ms: i64,
}

/// Full game state after applying a sequence of moves. (`apply_moves`)
///
/// `result`/`reason` are `None` while the game is ongoing (mirrors TS `null`).
/// bug-005: on a flag-fall/timeout early-return, `moves` is NOT appended to — but pure
/// `apply_moves` carries no clock and never flags, so it only ever appends legal moves;
/// the flag-fall path stays in the TS service. `clock` is `None` from pure `apply_moves`
/// and is filled by the service layer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GameState {
    pub fen: String,
    pub result: Option<GameResult>,
    pub reason: Option<GameResultReason>,
    pub moves: Vec<Ply>,
    pub clock: Option<ClockSnapshot>,
}

/// Position-derivable termination result. (`detect_result` returns `Option<DetectOutcome>`;
/// `None` == ongoing.) See handoff D4: only Checkmate / Stalemate / InsufficientMaterial /
/// FiftyMoveRule are in scope here; Threefold and Timeout are detected elsewhere.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetectOutcome {
    pub result: GameResult,
    pub reason: GameResultReason,
}

/// PGN headers for `to_pgn`. Mirrors the tags emitted by pgn-builder.ts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PgnHeaders {
    pub event: Option<String>,
    pub site: Option<String>,
    pub date: Option<String>,
    pub white: String,
    pub black: String,
    pub result: String,
    pub time_control: Option<String>,
    pub white_elo: Option<u32>,
    pub black_elo: Option<u32>,
    pub eco: Option<String>,
}
