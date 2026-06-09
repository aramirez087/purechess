use crate::board;
use crate::error::EngineError;
use crate::types::{DetectOutcome, GameResult, GameTermination};
use shakmaty::{Bitboard, Chess, Position};

pub fn detect_result_impl(fen: &str) -> Result<Option<DetectOutcome>, EngineError> {
    let pos = board::fen_to_pos(fen)?;
    Ok(detect_from_pos(&pos))
}

/// Check position-derivable termination. Returns `None` for ongoing games.
///
/// Threefold repetition and timeout are NOT detected here (need history/clock).
pub(crate) fn detect_from_pos(pos: &Chess) -> Option<DetectOutcome> {
    // 1. Checkmate: side to move is in check with no legal moves
    if pos.is_checkmate() {
        let result = match pos.turn() {
            shakmaty::Color::White => GameResult::BlackWins,
            shakmaty::Color::Black => GameResult::WhiteWins,
        };
        return Some(DetectOutcome { result, reason: GameTermination::Checkmate });
    }

    // 2. Stalemate: not in check, no legal moves
    if !pos.is_check() && pos.legal_moves().is_empty() {
        return Some(DetectOutcome { result: GameResult::Draw, reason: GameTermination::Stalemate });
    }

    // 3. Insufficient material
    if is_insufficient_material(pos.board()) {
        return Some(DetectOutcome {
            result: GameResult::Draw,
            reason: GameTermination::InsufficientMaterial,
        });
    }

    // 4. 50-move rule (halfmove clock >= 100 means 50 full moves since last pawn/capture)
    if pos.halfmoves() >= 100 {
        return Some(DetectOutcome {
            result: GameResult::Draw,
            reason: GameTermination::FiftyMoveRule,
        });
    }

    None
}

fn is_insufficient_material(board: &shakmaty::Board) -> bool {
    let total = board.occupied().count();

    // K vs K
    if total == 2 {
        return true;
    }

    // K+B vs K  or  K+N vs K
    if total == 3 {
        return board.bishops().count() == 1 || board.knights().count() == 1;
    }

    // K+B vs K+B, same-color bishops
    if total == 4
        && board.bishops().count() == 2
        && board.queens().is_empty()
        && board.rooks().is_empty()
        && board.knights().is_empty()
        && board.pawns().is_empty()
    {
        let on_light = (board.bishops() & Bitboard::LIGHT_SQUARES).count();
        // Both bishops on same color square (both light or both dark)
        return on_light == 0 || on_light == 2;
    }

    false
}
