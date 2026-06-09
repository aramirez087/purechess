//! Result detection tests — 12+ positions covering all detectable termination reasons.

#![allow(clippy::unwrap_used, clippy::expect_used)]

use purechess_engine::{GameResult, GameTermination, apply_moves, detect_result};

fn assert_result(fen: &str, expected_result: GameResult, expected_reason: GameTermination) {
    let outcome = detect_result(fen)
        .expect("detect_result must not error")
        .unwrap_or_else(|| panic!("expected {expected_result:?}/{expected_reason:?} for FEN: {fen}"));
    assert_eq!(outcome.result, expected_result, "wrong result for: {fen}");
    assert_eq!(outcome.reason, expected_reason, "wrong reason for: {fen}");
}

fn assert_ongoing(fen: &str) {
    let outcome = detect_result(fen).expect("detect_result must not error");
    assert!(outcome.is_none(), "expected ongoing but got {:?} for: {fen}", outcome);
}

// --- 1. Scholar's mate: black is in checkmate --------------------------------

#[test]
fn scholars_mate_checkmate() {
    // After Qxf7# — black king on e8, can't escape
    let fen = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
    assert_result(fen, GameResult::WhiteWins, GameTermination::Checkmate);
}

// --- 2. Stalemate: black to move, no legal moves, not in check ---------------

#[test]
fn stalemate_side_to_move() {
    // Black king a8, white Queen c7, white King b6 — black is stalemated
    let fen = "k7/2Q5/1K6/8/8/8/8/8 b - - 0 1";
    assert_result(fen, GameResult::Draw, GameTermination::Stalemate);
}

// --- 3. Stalemate: standard drawn endgame position ---------------------------

#[test]
fn stalemate_classic() {
    // FEN: black king on h8, white queen on g6, white king on f6 — black stalemated
    let fen = "7k/8/6QK/8/8/8/8/8 b - - 0 1";
    assert_result(fen, GameResult::Draw, GameTermination::Stalemate);
}

// --- 4. Checkmate: back-rank mate (white delivers) ---------------------------

#[test]
fn back_rank_checkmate_white_wins() {
    // White rook on a8, black king on h8 with pawns blocking — checkmate
    let fen = "R6k/6pp/8/8/8/8/8/4K3 b - - 0 1";
    assert_result(fen, GameResult::WhiteWins, GameTermination::Checkmate);
}

// --- 5. Checkmate: black delivers checkmate ----------------------------------

#[test]
fn checkmate_black_wins() {
    // Black queen b2 and rook b8 trap white king on a1 — checkmate
    let fen = "kr6/8/8/8/8/8/1q6/K7 w - - 0 1";
    assert_result(fen, GameResult::BlackWins, GameTermination::Checkmate);
}

// --- 6. K+Q vs K checkmate ---------------------------------------------------

#[test]
fn kq_vs_k_checkmate() {
    // White queen b7 (defended by king b6) gives check to black king a8 — checkmate
    let fen = "k7/1Q6/1K6/8/8/8/8/8 b - - 0 1";
    assert_result(fen, GameResult::WhiteWins, GameTermination::Checkmate);
}

// --- 7. 50-move rule (halfmove clock = 100) ----------------------------------

#[test]
fn fifty_move_rule_triggered() {
    let fen = "4k3/8/4K3/8/8/8/8/4R3 w - - 100 51";
    assert_result(fen, GameResult::Draw, GameTermination::FiftyMoveRule);
}

// --- 8. 50-move rule not yet (halfmove clock = 99) ---------------------------

#[test]
fn fifty_move_rule_not_yet() {
    let fen = "4k3/8/4K3/8/8/8/8/4R3 w - - 99 51";
    assert_ongoing(fen);
}

// --- 9. Threefold repetition via apply_moves ---------------------------------

#[test]
fn threefold_repetition_via_apply_moves() {
    // Nf3-Ng1-Nf3-Ng1-Nf3: starting position appears 3 times at ply 1, 3, 5
    let startpos = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    let ucis = ["g1f3", "g8f6", "f3g1", "f6g8", "g1f3", "g8f6", "f3g1", "f6g8"];
    let state = apply_moves(startpos, &ucis).expect("apply_moves ok");
    assert_eq!(state.result, Some(GameResult::Draw));
    assert_eq!(state.reason, Some(GameTermination::ThreefoldRepetition));
    // Moves applied should be 8 (the position repeated on ply 5 but the detection
    // fires after the 8th move completes the 3rd occurrence)
    // Actually threefold fires when count reaches 3 — the initial position is 1,
    // after ply 4 (g8f6→g8, position is starting) = 2, but wait the starting position
    // has different ep/castling after knight moves back. Let me think...
    // Actually knight moves don't change castling rights or ep, so the 4-field FEN key
    // DOES repeat. The starting pos is counted at init. After g1f3/g8f6/f3g1/f6g8 = 2.
    // After g1f3/g8f6/f3g1/f6g8 again = 3 → threefold on move 8.
    // But wait: after Nf3 the position changes. After Ng1 it's back to starting.
    // Starting position key count: 1 (initial), 2 (after ply 4), 3 (after ply 8) → fires after ply 8
}

// --- 10. Insufficient material: K vs K ---------------------------------------

#[test]
fn insufficient_material_k_vs_k() {
    let fen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";
    assert_result(fen, GameResult::Draw, GameTermination::InsufficientMaterial);
}

// --- 11. Insufficient material: K+B vs K ------------------------------------

#[test]
fn insufficient_material_kb_vs_k() {
    let fen = "4k3/8/8/8/8/8/8/4KB2 w - - 0 1";
    assert_result(fen, GameResult::Draw, GameTermination::InsufficientMaterial);
}

// --- 12. Insufficient material: K+N vs K ------------------------------------

#[test]
fn insufficient_material_kn_vs_k() {
    let fen = "4k3/8/8/8/8/8/8/4KN2 w - - 0 1";
    assert_result(fen, GameResult::Draw, GameTermination::InsufficientMaterial);
}

// --- 13. Insufficient material: K+B vs K+B (same-color bishops) -------------

#[test]
fn insufficient_material_same_color_bishops() {
    // Both bishops on dark squares: c1 (dark) and f8 (dark)
    let fen = "5b1k/8/8/8/8/8/8/2B1K3 w - - 0 1";
    assert_result(fen, GameResult::Draw, GameTermination::InsufficientMaterial);
}

// --- 14. NOT insufficient: K+B vs K+B (different-color bishops) --------------

#[test]
fn sufficient_material_diff_color_bishops() {
    // Bishops on different colors are NOT insufficient material in standard rules
    // White bishop on c1 (light), black bishop on d8 (light) — actually c1 and d8 are both light
    // Let me use c1 (light) and e8 for black bishop on dark
    // c1 = light square, f8 = light square
    // To get different colors: c1=light, d8=dark? d8 is a dark square.
    // c1 is a light square (c=3rd file=odd, 1st rank=odd → 3+1=4=even → dark?
    // Actually: a1 is dark. Squares alternate. a1=dark, b1=light, c1=dark, d1=light...
    // c1 is DARK. b8 is dark. So c1 and b8 are both dark.
    // Let me use b1 (light) and a8 (light) — same color, so NOT different.
    // Actually I'll use a direct test: if bishops are on different colors, it's sufficient
    // material and the result should be ongoing (not draw by insufficient material).
    let fen = "1b2k3/8/8/8/8/8/8/1B2K3 w - - 0 1";
    // b1 and b8: b1 is light (file b=2, rank 1: 2+1=3=odd → light)
    // b8: file b=2, rank 8: 2+8=10=even → dark
    // Different colors → sufficient material (in basic rules)
    // Hmm but this is ambiguous. Let me just check with a clearly different case.
    // Actually FIDE rules say K+B vs K+B with bishops on different colors can be drawn
    // but it's NOT automatic insufficient material.
    // For this test: position is ongoing (not automatically drawn)
    assert_ongoing(fen);
}

// --- 15. Ongoing: starting position ------------------------------------------

#[test]
fn ongoing_startpos() {
    let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    assert_ongoing(fen);
}

// --- 16. Ongoing: complex middle game ----------------------------------------

#[test]
fn ongoing_middlegame() {
    // After 1. e4 e5 2. Nf3 Nc6 3. Bb5
    let fen = "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";
    assert_ongoing(fen);
}

// --- 17. Ongoing: after one move ----------------------------------------------

#[test]
fn ongoing_after_one_move() {
    let fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    assert_ongoing(fen);
}
