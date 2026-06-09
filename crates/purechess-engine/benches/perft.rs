#![allow(clippy::expect_used)]

use criterion::{black_box, criterion_group, criterion_main, Criterion};

const STARTPOS: &str = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

fn bench_legal_moves_startpos(c: &mut Criterion) {
    c.bench_function("legal_moves_startpos", |b| {
        b.iter(|| purechess_engine::legal_moves(black_box(STARTPOS)).expect("ok"))
    });
}

fn bench_apply_moves_depth1(c: &mut Criterion) {
    // Apply one move: e2e4
    c.bench_function("apply_moves_depth1", |b| {
        b.iter(|| {
            purechess_engine::apply_moves(black_box(STARTPOS), black_box(&["e2e4"])).expect("ok")
        })
    });
}

fn bench_apply_moves_depth3(c: &mut Criterion) {
    // Apply 3 moves
    c.bench_function("apply_moves_depth3", |b| {
        b.iter(|| {
            purechess_engine::apply_moves(
                black_box(STARTPOS),
                black_box(&["e2e4", "e7e5", "g1f3"]),
            )
            .expect("ok")
        })
    });
}

fn bench_apply_moves_depth5(c: &mut Criterion) {
    // Apply 5 moves (short Ruy Lopez)
    c.bench_function("apply_moves_depth5", |b| {
        b.iter(|| {
            purechess_engine::apply_moves(
                black_box(STARTPOS),
                black_box(&["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]),
            )
            .expect("ok")
        })
    });
}

criterion_group!(
    benches,
    bench_legal_moves_startpos,
    bench_apply_moves_depth1,
    bench_apply_moves_depth3,
    bench_apply_moves_depth5
);
criterion_main!(benches);
