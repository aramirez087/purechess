//! Perft conformance suite for the PureChess native engine.
//!
//! Perft (performance test) counts the number of leaf nodes in the move tree at a fixed
//! depth. A correct legal-move generator reproduces the canonical published counts exactly;
//! any mismatch means a movegen bug (missed/extra move, bad castling/en-passant/promotion).
//!
//! Fixture numbers are the canonical tables from the Chess Programming Wiki "Perft Results"
//! page <https://www.chessprogramming.org/Perft_Results>, which match Stockfish's published
//! perft output:
//!   - startpos          : initial position
//!   - kiwipete          : CPW "Position 2" (Peter McKenzie's tactical stress position)
//!   - endgame           : CPW "Position 3"
//!   - ep_castle_stress  : CPW "Position 4" (en-passant + castling + promotion edge cases)
//!
//! Depths 1-3 run in CI for all positions.
//! Depth 4 runs for all positions (fast with --release).
//! Depth 5 runs only for positions with < 5M leaf nodes (startpos and endgame).
//! kiwipete d5 (193M) and ep_castle_stress d5 (15.8M) are #[ignore]d — WP5 parity suite.
//!
//! Run fast perft: cargo test --release --features impl
//! Run slow perft: cargo test --release --features impl -- --ignored

#![cfg(feature = "impl")]
#![allow(clippy::unwrap_used, clippy::expect_used)]

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct PerftCase {
    name: String,
    fen: String,
    depth_1: u64,
    depth_2: u64,
    depth_3: u64,
    depth_4: u64,
    depth_5: u64,
}

const FIXTURES: &str = include_str!("fixtures/perft_cases.json");

fn cases() -> Vec<PerftCase> {
    serde_json::from_str(FIXTURES).expect("perft_cases.json must parse")
}

fn case(name: &str) -> PerftCase {
    cases()
        .into_iter()
        .find(|c| c.name == name)
        .unwrap_or_else(|| panic!("fixture `{name}` not found"))
}

fn assert_perft(c: &PerftCase, depth: u32, expected: u64) {
    let got = purechess_engine::perft(&c.fen, depth)
        .unwrap_or_else(|e| panic!("perft({}, {depth}) errored: {e}", c.name));
    assert_eq!(
        got, expected,
        "perft mismatch for `{}` at depth {depth}: got {got}, want {expected}",
        c.name
    );
}

// --- startpos -----------------------------------------------------------------

#[test]
fn startpos_depth_1() {
    let c = case("startpos");
    assert_perft(&c, 1, c.depth_1);
}

#[test]
fn startpos_depth_2() {
    let c = case("startpos");
    assert_perft(&c, 2, c.depth_2);
}

#[test]
fn startpos_depth_3() {
    let c = case("startpos");
    assert_perft(&c, 3, c.depth_3);
}

#[test]
fn startpos_depth_4() {
    let c = case("startpos");
    assert_perft(&c, 4, c.depth_4);
}

// startpos d5 = 4,865,609 < 5M — run in CI
#[test]
fn startpos_depth_5() {
    let c = case("startpos");
    assert_perft(&c, 5, c.depth_5);
}

// --- kiwipete (CPW Position 2) ------------------------------------------------

#[test]
fn kiwipete_depth_1() {
    let c = case("kiwipete");
    assert_perft(&c, 1, c.depth_1);
}

#[test]
fn kiwipete_depth_2() {
    let c = case("kiwipete");
    assert_perft(&c, 2, c.depth_2);
}

#[test]
fn kiwipete_depth_3() {
    let c = case("kiwipete");
    assert_perft(&c, 3, c.depth_3);
}

#[test]
fn kiwipete_depth_4() {
    let c = case("kiwipete");
    assert_perft(&c, 4, c.depth_4);
}

// kiwipete d5 = 193,690,690 > 5M — WP5 parity suite
#[test]
#[ignore = "193M nodes — WP5 deep parity"]
fn kiwipete_depth_5() {
    let c = case("kiwipete");
    assert_perft(&c, 5, c.depth_5);
}

// --- endgame (CPW Position 3) -------------------------------------------------

#[test]
fn endgame_depth_1() {
    let c = case("endgame");
    assert_perft(&c, 1, c.depth_1);
}

#[test]
fn endgame_depth_2() {
    let c = case("endgame");
    assert_perft(&c, 2, c.depth_2);
}

#[test]
fn endgame_depth_3() {
    let c = case("endgame");
    assert_perft(&c, 3, c.depth_3);
}

#[test]
fn endgame_depth_4() {
    let c = case("endgame");
    assert_perft(&c, 4, c.depth_4);
}

// endgame d5 = 674,624 < 5M — run in CI
#[test]
fn endgame_depth_5() {
    let c = case("endgame");
    assert_perft(&c, 5, c.depth_5);
}

// --- ep_castle_stress (CPW Position 4) ----------------------------------------

#[test]
fn ep_castle_stress_depth_1() {
    let c = case("ep_castle_stress");
    assert_perft(&c, 1, c.depth_1);
}

#[test]
fn ep_castle_stress_depth_2() {
    let c = case("ep_castle_stress");
    assert_perft(&c, 2, c.depth_2);
}

#[test]
fn ep_castle_stress_depth_3() {
    let c = case("ep_castle_stress");
    assert_perft(&c, 3, c.depth_3);
}

#[test]
fn ep_castle_stress_depth_4() {
    let c = case("ep_castle_stress");
    assert_perft(&c, 4, c.depth_4);
}

// ep_castle_stress d5 = 15,833,292 > 5M — WP5 parity suite
#[test]
#[ignore = "15.8M nodes — WP5 deep parity"]
fn ep_castle_stress_depth_5() {
    let c = case("ep_castle_stress");
    assert_perft(&c, 5, c.depth_5);
}
