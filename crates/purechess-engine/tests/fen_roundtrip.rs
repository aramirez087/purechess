//! FEN round-trip tests.
//!
//! Each test parses a FEN via `parse_fen`, reconstructs the FEN string from the
//! `ParsedFen` fields, and asserts it matches the canonical serialization.
//!
//! The proptest suite generates random legal positions by applying a seed-driven
//! sequence of moves from the starting position and verifies round-trip fidelity.

#![allow(clippy::unwrap_used, clippy::expect_used)]

use proptest::prelude::*;
use purechess_engine::{Color, parse_fen};

// Reconstruct FEN string from ParsedFen fields
fn reconstruct(fen: &str) -> String {
    let p = parse_fen(fen).expect("parse_fen must succeed");
    format!(
        "{} {} {} {} {} {}",
        p.piece_placement,
        if p.active_color == Color::White { "w" } else { "b" },
        p.castling,
        p.en_passant.as_deref().unwrap_or("-"),
        p.halfmove_clock,
        p.fullmove_number,
    )
}

// Normalise a FEN by round-tripping it through the engine (sets EnPassantMode::Always)
fn canonical(fen: &str) -> String {
    reconstruct(fen)
}

// --- Starting position -------------------------------------------------------

#[test]
fn roundtrip_startpos() {
    let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    assert_eq!(canonical(fen), fen);
}

// --- Castling rights ---------------------------------------------------------

#[test]
fn roundtrip_castling_all() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_none() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_white_only() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQ - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_black_only() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w kq - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_kingside_only() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w Kk - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_queenside_only() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w Qq - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_white_king_only() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w K - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_white_queen_only() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w Q - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_black_king_only() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w k - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castling_black_queen_only() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w q - 0 1";
    assert_eq!(canonical(fen), fen);
}

// --- En passant --------------------------------------------------------------

#[test]
fn roundtrip_ep_e3() {
    // After 1. e4 — black can capture en passant on e3
    let fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_ep_d6() {
    // After 1. e4 e5 2. d4 — black pushed pawn, ep on d6
    let fen = "rnbqkbnr/ppp1pppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq d6 0 3";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_no_ep() {
    let fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1";
    assert_eq!(canonical(fen), fen);
}

// --- Post-promotion positions -----------------------------------------------

#[test]
fn roundtrip_post_promotion_queen() {
    // White queen on e8 after promotion
    let fen = "4Q3/8/8/8/8/8/8/4K2k w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_post_promotion_rook() {
    let fen = "4R3/8/8/8/8/8/8/4K2k w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

// --- Study / known positions ------------------------------------------------

#[test]
fn roundtrip_kiwipete() {
    let fen = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_endgame_cpw3() {
    let fen = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_ep_castle_stress() {
    let fen = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_ruy_lopez() {
    let fen = "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_scholars_mate_final() {
    // White just delivered Qxf7#
    let fen = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_king_endgame() {
    let fen = "4k3/8/4K3/8/8/8/8/8 w - - 10 60";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_halfmove_clock_nonzero() {
    // Halfmove clock at 12
    let fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 12 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_fullmove_large() {
    let fen = "4k3/8/4K3/8/8/8/8/8 w - - 0 100";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_black_to_move() {
    let fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_complex_middle_game() {
    let fen = "r2qk2r/pp1nbppp/2p1pn2/3p4/2PP4/2N1PN2/PPQ1BPPP/R3K2R w KQkq - 2 9";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_two_rooks_no_castling() {
    let fen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b - - 4 20";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_pawn_structure() {
    let fen = "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_isolated_kings() {
    let fen = "8/8/8/8/8/8/8/K6k w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_king_bishop_vs_king() {
    let fen = "4k3/8/8/8/8/8/8/4KB2 w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_king_knight_vs_king() {
    let fen = "4k3/8/8/8/8/8/8/4KN2 w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_same_bishop_pair() {
    // K+B vs K+B, bishops on same color (both light squares)
    let fen = "4kb2/8/8/8/8/8/8/4KB2 w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_fifty_move_position() {
    // Halfmove clock near 50-move rule
    let fen = "4k3/8/4K3/8/8/8/8/4R3 w - - 99 50";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_fifty_move_triggered() {
    // Halfmove clock exactly at 100
    let fen = "4k3/8/4K3/8/8/8/8/4R3 w - - 100 51";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_sicilian_najdorf() {
    let fen = "rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_queens_gambit() {
    let fen = "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_french_defense() {
    let fen = "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_kings_indian() {
    // After 1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.Nf3 — knight on f6, pawn on g6, bishop on g7
    let fen = "rnbqk2r/ppppppbp/5np1/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_back_rank_mate() {
    let fen = "6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_ep_a_file() {
    // En passant on a-file
    let fen = "rnbqkbnr/1ppppppp/8/pP6/8/8/P1PPPPPP/RNBQKBNR w KQkq a6 0 2";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_ep_h_file() {
    // After 1. h4 Nf6 2. h5 g5 — white h5 pawn can capture en passant on g6
    let fen = "rnbqkb1r/pppppp1p/5n2/6pP/8/8/PPPPPPP1/RNBQKBNR w KQkq g6 0 3";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_late_endgame_rook() {
    let fen = "8/8/8/4k3/8/4K3/8/4R3 w - - 6 42";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_pawn_majority() {
    let fen = "4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_castled_position() {
    // Both sides castled, no castling rights remain
    let fen = "r4rk1/pppppppp/8/8/8/8/PPPPPPPP/R4RK1 w - - 0 10";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_stalemate_setup() {
    // Classic stalemate setup
    let fen = "5k2/5P2/5K2/8/8/8/8/8 b - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_en_passant_only_legal_move() {
    // En passant is the only legal move
    let fen = "8/8/8/1k1pP3/8/8/8/4K3 w - d6 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_promotion_pending() {
    // White pawn on 7th rank about to promote
    let fen = "8/4P3/8/8/8/8/8/4K2k w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

#[test]
fn roundtrip_multiple_promotions() {
    // Two white queens (post-promotion), black king far away
    let fen = "K7/Q7/8/8/8/8/Q7/4k3 w - - 0 1";
    assert_eq!(canonical(fen), fen);
}

// --- Proptest round-trip using random legal positions -----------------------

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn proptest_fen_roundtrip(seed in 0u64..u64::MAX, moves_count in 0usize..30) {
        // Build a position by applying moves_count random legal moves from startpos.
        // Use a simple LCG for deterministic move selection from the seed.
        let mut fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1".to_string();
        let mut state = seed;

        for _ in 0..moves_count {
            let legal = purechess_engine::legal_moves(&fen).expect("legal_moves ok");
            if legal.is_empty() {
                break;
            }
            // LCG step (Knuth multiplicative)
            state = state.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1_442_695_040_888_963_407);
            let idx = (state as usize) % legal.len();
            let outcome = purechess_engine::validate_move(&fen, &legal[idx].uci).expect("validate_move ok");
            fen = outcome.new_fen;
        }

        // Round-trip: parse the FEN and reconstruct it from ParsedFen fields
        let parsed = parse_fen(&fen).expect("parse_fen ok");
        let reconstructed = format!(
            "{} {} {} {} {} {}",
            parsed.piece_placement,
            if parsed.active_color == Color::White { "w" } else { "b" },
            parsed.castling,
            parsed.en_passant.as_deref().unwrap_or("-"),
            parsed.halfmove_clock,
            parsed.fullmove_number,
        );
        prop_assert_eq!(fen, reconstructed);
    }
}
