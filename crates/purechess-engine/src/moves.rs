use std::collections::HashMap;

use shakmaty::{Move, Position, Role};

use crate::board;
use crate::error::EngineError;
use crate::result;
use crate::types::{GameResult, GameState, GameTermination, LegalMove, MoveOutcome, Ply};

pub fn validate_move_impl(fen: &str, uci: &str) -> Result<MoveOutcome, EngineError> {
    let pos = board::fen_to_pos(fen)?;
    // uci_to_move already checks legality via pos.is_legal()
    let m = board::uci_to_move(&pos, uci)?;

    let is_en_passant = matches!(m, Move::EnPassant { .. });
    let captured_role = if is_en_passant {
        Some(Role::Pawn)
    } else {
        pos.board().piece_at(m.to()).map(|p| p.role)
    };
    let is_capture = captured_role.is_some();

    // SanPlus::from_move consumes pos — clone it
    let san_str = board::move_to_san(pos.clone(), &m);
    let is_check = san_str.ends_with('+');
    let is_mate = san_str.ends_with('#');

    let mut new_pos = pos;
    new_pos.play_unchecked(&m);

    Ok(MoveOutcome {
        new_fen: board::pos_to_fen(&new_pos),
        san: san_str,
        is_capture,
        captured_piece: captured_role.map(board::role_to_piece_kind),
        is_check,
        is_mate,
    })
}

pub fn legal_moves_impl(fen: &str) -> Result<Vec<LegalMove>, EngineError> {
    let pos = board::fen_to_pos(fen)?;
    let legal = pos.legal_moves();
    let mut moves = Vec::with_capacity(legal.len());

    for m in &legal {
        let uci = board::move_to_uci_str(m);
        let san = board::move_to_san(pos.clone(), m);
        moves.push(LegalMove { uci, san });
    }

    Ok(moves)
}

pub fn apply_moves_impl(fen: &str, ucis: &[&str]) -> Result<GameState, EngineError> {
    let mut pos = board::fen_to_pos(fen)?;
    let mut applied: Vec<Ply> = Vec::with_capacity(ucis.len());
    let mut counts: HashMap<String, u32> = HashMap::new();

    // Count starting position for threefold detection
    let start_key = board::fen_position_key(&board::pos_to_fen(&pos));
    *counts.entry(start_key).or_insert(0) += 1;

    let mut final_result: Option<GameResult> = None;
    let mut final_reason: Option<GameTermination> = None;

    for &uci in ucis {
        // bug-005 semantics: check termination BEFORE applying the move.
        // If already terminated, return early without appending the attempted move.
        if let Some(outcome) = result::detect_from_pos(&pos) {
            final_result = Some(outcome.result);
            final_reason = Some(outcome.reason);
            break;
        }

        // uci_to_move validates legality
        let m = board::uci_to_move(&pos, uci)?;

        let ply_number = (applied.len() as u32) + 1;
        let by = board::color_from_shakmaty(pos.turn());
        // SanPlus::from_move consumes pos — clone it before applying
        let san_str = board::move_to_san(pos.clone(), &m);

        pos.play_unchecked(&m);
        let fen_after = board::pos_to_fen(&pos);

        applied.push(Ply {
            ply: ply_number,
            san: san_str,
            uci: uci.to_string(),
            fen_after: fen_after.clone(),
            by,
        });

        // Update threefold counter with the new position
        let key = board::fen_position_key(&fen_after);
        let count = counts.entry(key).or_insert(0);
        *count += 1;
        if *count >= 3 {
            final_result = Some(GameResult::Draw);
            final_reason = Some(GameTermination::ThreefoldRepetition);
            break;
        }

        // Check for other terminal conditions after the move
        if let Some(outcome) = result::detect_from_pos(&pos) {
            final_result = Some(outcome.result);
            final_reason = Some(outcome.reason);
            break;
        }
    }

    Ok(GameState {
        fen: board::pos_to_fen(&pos),
        result: final_result,
        reason: final_reason,
        moves: applied,
        clock: None,
    })
}
