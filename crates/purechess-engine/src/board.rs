use crate::error::EngineError;
use crate::types::{Color, PieceKind};
use shakmaty::{
    CastlingMode, Chess, Color as ShakColor, EnPassantMode, Move, Role,
    fen::Fen,
    san::SanPlus,
    uci::UciMove,
};

pub fn fen_to_pos(fen: &str) -> Result<Chess, EngineError> {
    let f: Fen = fen
        .parse()
        .map_err(|e: shakmaty::fen::ParseFenError| EngineError::InvalidFen(e.to_string()))?;
    f.into_position(CastlingMode::Standard)
        .map_err(|e| EngineError::InvalidFen(e.to_string()))
}

pub fn pos_to_fen(pos: &Chess) -> String {
    // EnPassantMode::Legal matches chess.js 1.x: emit EP square only when a legal
    // EP capture exists. This ensures FEN round-trips across the FFI boundary agree.
    Fen::from_position(pos.clone(), EnPassantMode::Legal).to_string()
}

/// Parse UCI string and validate legality against the position.
pub fn uci_to_move(pos: &Chess, uci: &str) -> Result<Move, EngineError> {
    let uci_move: UciMove = uci
        .parse()
        .map_err(|_| EngineError::IllegalMove(format!("bad UCI: {uci}")))?;
    uci_move
        .to_move(pos)
        .map_err(|_| EngineError::IllegalMove(uci.to_string()))
}

pub fn move_to_uci_str(m: &Move) -> String {
    UciMove::from_standard(m).to_string()
}

/// Generate SAN+suffix string. Takes `pos` by value (SanPlus::from_move consumes it).
pub fn move_to_san(pos: Chess, m: &Move) -> String {
    SanPlus::from_move(pos, m).to_string()
}

pub fn role_to_piece_kind(role: Role) -> PieceKind {
    match role {
        Role::Pawn => PieceKind::Pawn,
        Role::Knight => PieceKind::Knight,
        Role::Bishop => PieceKind::Bishop,
        Role::Rook => PieceKind::Rook,
        Role::Queen => PieceKind::Queen,
        Role::King => PieceKind::King,
    }
}

pub fn color_from_shakmaty(c: ShakColor) -> Color {
    match c {
        ShakColor::White => Color::White,
        ShakColor::Black => Color::Black,
    }
}

/// First 4 FEN fields joined by space — matches `fenPosition()` in fen-utils.ts for
/// threefold repetition detection.
pub fn fen_position_key(fen: &str) -> String {
    fen.split(' ').take(4).collect::<Vec<_>>().join(" ")
}
