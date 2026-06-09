//! napi-rs bindings — WP3. Exposes the frozen Rust API to Node.js.
//!
//! All types and functions in this module are only compiled when `feature = "ffi"` is
//! active (gated in lib.rs via `#[cfg(feature = "ffi")] pub mod ffi;`).
//!
//! Design decisions:
//! - JS-facing `*Js` structs are new types here, not the frozen `types.rs` types, so the
//!   C-ABI surface stays napi-free.
//! - Enum variants (`Color`, `PieceKind`, `GameResult`, `GameResultReason`) are exposed as
//!   `String` fields using the serde discriminants (e.g. "w", "white_wins", "checkmate")
//!   which byte-match the TS enums in packages/shared.
//! - napi-rs v3 auto-converts snake_case field names to camelCase in the generated TS.

use napi_derive::napi;

use crate::{
    error::EngineError,
    fen::ParsedFen,
    types::{
        ClockSnapshot, DetectOutcome, GameState, LegalMove, MoveOutcome, PgnHeaders, Ply,
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn engine_err(e: EngineError) -> napi::Error {
    napi::Error::from_reason(e.to_string())
}

/// Serialize an enum variant to its serde string discriminant without unwrap/expect.
fn serialize_enum<T: serde::Serialize>(val: &T) -> String {
    serde_json::to_value(val)
        .ok()
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_default()
}

// ── JS-facing object types ────────────────────────────────────────────────────
// napi-rs v3 auto-converts snake_case field names → camelCase in generated TS.
// e.g. `new_fen` → `newFen`, `is_capture` → `isCapture`.

#[napi(object)]
#[derive(Default)]
pub struct MoveOutcomeJs {
    pub new_fen: String,
    pub san: String,
    pub is_capture: bool,
    /// Serialized `PieceKind` discriminant ("p"|"n"|"b"|"r"|"q"|"k"), or null.
    pub captured_piece: Option<String>,
    pub is_check: bool,
    pub is_mate: bool,
}

impl From<MoveOutcome> for MoveOutcomeJs {
    fn from(m: MoveOutcome) -> Self {
        MoveOutcomeJs {
            new_fen: m.new_fen,
            san: m.san,
            is_capture: m.is_capture,
            captured_piece: m.captured_piece.map(|p| serialize_enum(&p)),
            is_check: m.is_check,
            is_mate: m.is_mate,
        }
    }
}

#[napi(object)]
#[derive(Default)]
pub struct LegalMoveJs {
    pub uci: String,
    pub san: String,
}

impl From<LegalMove> for LegalMoveJs {
    fn from(m: LegalMove) -> Self {
        LegalMoveJs { uci: m.uci, san: m.san }
    }
}

#[napi(object)]
#[derive(Default)]
pub struct PlyJs {
    pub ply: u32,
    pub san: String,
    pub uci: String,
    pub fen_after: String,
    /// Serialized `Color` discriminant: "w" | "b".
    pub by: String,
}

impl From<Ply> for PlyJs {
    fn from(p: Ply) -> Self {
        PlyJs {
            ply: p.ply,
            san: p.san,
            uci: p.uci,
            fen_after: p.fen_after,
            by: serialize_enum(&p.by),
        }
    }
}

#[napi(object)]
#[derive(Default, Clone, Copy)]
pub struct ClockSnapshotJs {
    pub white_ms: i64,
    pub black_ms: i64,
    pub last_tick_at: i64,
    pub increment_ms: i64,
}

impl From<ClockSnapshot> for ClockSnapshotJs {
    fn from(c: ClockSnapshot) -> Self {
        ClockSnapshotJs {
            white_ms: c.white_ms,
            black_ms: c.black_ms,
            last_tick_at: c.last_tick_at,
            increment_ms: c.increment_ms,
        }
    }
}

impl From<ClockSnapshotJs> for ClockSnapshot {
    fn from(c: ClockSnapshotJs) -> Self {
        ClockSnapshot {
            white_ms: c.white_ms,
            black_ms: c.black_ms,
            last_tick_at: c.last_tick_at,
            increment_ms: c.increment_ms,
        }
    }
}

#[napi(object)]
pub struct GameStateJs {
    pub fen: String,
    /// Serialized `GameResult` discriminant: "white_wins"|"black_wins"|"draw", or null.
    pub result: Option<String>,
    /// Serialized `GameResultReason` discriminant, or null.
    pub reason: Option<String>,
    pub moves: Vec<PlyJs>,
    pub clock: Option<ClockSnapshotJs>,
}

impl From<GameState> for GameStateJs {
    fn from(s: GameState) -> Self {
        GameStateJs {
            fen: s.fen,
            result: s.result.map(|r| serialize_enum(&r)),
            reason: s.reason.map(|r| serialize_enum(&r)),
            moves: s.moves.into_iter().map(PlyJs::from).collect(),
            clock: s.clock.map(ClockSnapshotJs::from),
        }
    }
}

#[napi(object)]
#[derive(Default)]
pub struct DetectOutcomeJs {
    pub result: String,
    pub reason: String,
}

impl From<DetectOutcome> for DetectOutcomeJs {
    fn from(d: DetectOutcome) -> Self {
        DetectOutcomeJs {
            result: serialize_enum(&d.result),
            reason: serialize_enum(&d.reason),
        }
    }
}

#[napi(object)]
#[derive(Default)]
pub struct PgnHeadersJs {
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

impl From<PgnHeadersJs> for PgnHeaders {
    fn from(h: PgnHeadersJs) -> Self {
        PgnHeaders {
            event: h.event,
            site: h.site,
            date: h.date,
            white: h.white,
            black: h.black,
            result: h.result,
            time_control: h.time_control,
            white_elo: h.white_elo,
            black_elo: h.black_elo,
            eco: h.eco,
        }
    }
}

#[napi(object)]
#[derive(Default)]
pub struct ParsedFenJs {
    pub piece_placement: String,
    /// Serialized `Color` discriminant: "w" | "b".
    pub active_color: String,
    pub castling: String,
    pub en_passant: Option<String>,
    pub halfmove_clock: u32,
    pub fullmove_number: u32,
}

impl From<ParsedFen> for ParsedFenJs {
    fn from(f: ParsedFen) -> Self {
        ParsedFenJs {
            piece_placement: f.piece_placement,
            active_color: serialize_enum(&f.active_color),
            castling: f.castling,
            en_passant: f.en_passant,
            halfmove_clock: f.halfmove_clock,
            fullmove_number: f.fullmove_number,
        }
    }
}

// ── Exported functions ────────────────────────────────────────────────────────

#[napi]
pub fn validate_move(fen: String, uci: String) -> napi::Result<MoveOutcomeJs> {
    crate::validate_move(&fen, &uci).map(MoveOutcomeJs::from).map_err(engine_err)
}

#[napi]
pub fn legal_moves(fen: String) -> napi::Result<Vec<LegalMoveJs>> {
    crate::legal_moves(&fen)
        .map(|ms| ms.into_iter().map(LegalMoveJs::from).collect())
        .map_err(engine_err)
}

#[napi]
pub fn apply_moves(
    fen: String,
    ucis: Vec<String>,
    clock: Option<ClockSnapshotJs>,
) -> napi::Result<GameStateJs> {
    let uci_refs: Vec<&str> = ucis.iter().map(String::as_str).collect();
    let mut state = crate::apply_moves(&fen, &uci_refs).map_err(engine_err)?;
    // Pass clock through — the pure engine doesn't tick, the TS service owns it.
    if let Some(c) = clock {
        state.clock = Some(c.into());
    }
    Ok(GameStateJs::from(state))
}

#[napi]
pub fn detect_result(fen: String) -> napi::Result<Option<DetectOutcomeJs>> {
    crate::detect_result(&fen)
        .map(|opt| opt.map(DetectOutcomeJs::from))
        .map_err(engine_err)
}

#[napi]
pub fn to_pgn(fen: String, ucis: Vec<String>, headers: PgnHeadersJs) -> napi::Result<String> {
    let uci_refs: Vec<&str> = ucis.iter().map(String::as_str).collect();
    let headers = PgnHeaders::from(headers);
    crate::to_pgn(&fen, &uci_refs, &headers).map_err(engine_err)
}

#[napi]
pub fn parse_fen(fen: String) -> napi::Result<ParsedFenJs> {
    crate::parse_fen(&fen).map(ParsedFenJs::from).map_err(engine_err)
}
