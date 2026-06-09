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
//! WP1 status: the whole suite is gated behind the `impl` feature, which is OFF by default.
//! This session is a pure spec pass — `cargo test` compiles and runs ZERO perft assertions.
//! WP2 enables `impl`, implements `purechess_engine::perft`, and these tests start validating
//! real move counts. Depths 1-3 run in CI; depths 4-5 are `#[ignore]`d (slow — WP5 parity).

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
fn startpos_depth_1_3() {
    let c = case("startpos");
    assert_perft(&c, 1, c.depth_1);
    assert_perft(&c, 2, c.depth_2);
    assert_perft(&c, 3, c.depth_3);
}

#[test]
#[ignore = "slow: WP5 deep parity suite"]
fn startpos_depth_4_5() {
    let c = case("startpos");
    assert_perft(&c, 4, c.depth_4);
    assert_perft(&c, 5, c.depth_5);
}

// --- kiwipete (CPW Position 2) -------------------------------------------------

#[test]
fn kiwipete_depth_1_3() {
    let c = case("kiwipete");
    assert_perft(&c, 1, c.depth_1);
    assert_perft(&c, 2, c.depth_2);
    assert_perft(&c, 3, c.depth_3);
}

#[test]
#[ignore = "slow: WP5 deep parity suite"]
fn kiwipete_depth_4_5() {
    let c = case("kiwipete");
    assert_perft(&c, 4, c.depth_4);
    assert_perft(&c, 5, c.depth_5);
}

// --- endgame (CPW Position 3) --------------------------------------------------

#[test]
fn endgame_depth_1_3() {
    let c = case("endgame");
    assert_perft(&c, 1, c.depth_1);
    assert_perft(&c, 2, c.depth_2);
    assert_perft(&c, 3, c.depth_3);
}

#[test]
#[ignore = "slow: WP5 deep parity suite"]
fn endgame_depth_4_5() {
    let c = case("endgame");
    assert_perft(&c, 4, c.depth_4);
    assert_perft(&c, 5, c.depth_5);
}

// --- ep_castle_stress (CPW Position 4) -----------------------------------------

#[test]
fn ep_castle_stress_depth_1_3() {
    let c = case("ep_castle_stress");
    assert_perft(&c, 1, c.depth_1);
    assert_perft(&c, 2, c.depth_2);
    assert_perft(&c, 3, c.depth_3);
}

#[test]
#[ignore = "slow: WP5 deep parity suite"]
fn ep_castle_stress_depth_4_5() {
    let c = case("ep_castle_stress");
    assert_perft(&c, 4, c.depth_4);
    assert_perft(&c, 5, c.depth_5);
}
