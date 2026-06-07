import { describe, it, expect } from 'vitest';
import { replayToFen, validateReplay } from '@/lib/replay';
import type { WireMove } from '@purchess/shared';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const RUYLOPEZ_MOVES: WireMove[] = [
  { ply: 1, san: 'e4', uci: 'e2e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', clockAfterMs: 180000, moveTimeMs: 1000, by: 'w' },
  { ply: 2, san: 'e5', uci: 'e7e5', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', clockAfterMs: 180000, moveTimeMs: 1000, by: 'b' },
  { ply: 3, san: 'Nf3', uci: 'g1f3', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', clockAfterMs: 179000, moveTimeMs: 1000, by: 'w' },
  { ply: 4, san: 'Nc6', uci: 'b8c6', fenAfter: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', clockAfterMs: 179500, moveTimeMs: 500, by: 'b' },
  { ply: 5, san: 'Bb5', uci: 'f1b5', fenAfter: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', clockAfterMs: 178000, moveTimeMs: 1000, by: 'w' },
  { ply: 6, san: 'a6', uci: 'a7a6', fenAfter: 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4', clockAfterMs: 178500, moveTimeMs: 1000, by: 'b' },
];

const FINAL_FEN = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';

describe('replayToFen', () => {
  it('returns starting FEN at ply 0', () => {
    const fen = replayToFen(RUYLOPEZ_MOVES, 0);
    expect(fen).not.toBeNull();
    expect(fen!.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')).toBe(true);
  });

  it('returns correct FEN after 1.e4', () => {
    const fen = replayToFen(RUYLOPEZ_MOVES, 1);
    expect(fen).not.toBeNull();
    expect(fen).toContain('4P3');
    expect(fen).toContain(' b ');
  });

  it('returns correct final FEN after all moves', () => {
    const fen = replayToFen(RUYLOPEZ_MOVES, RUYLOPEZ_MOVES.length);
    expect(fen).not.toBeNull();
    const fenParts = fen!.split(' ').slice(0, 4).join(' ');
    const finalParts = FINAL_FEN.split(' ').slice(0, 4).join(' ');
    expect(fenParts).toBe(finalParts);
  });

  it('returns null for invalid UCI move', () => {
    const corrupt: WireMove[] = [
      { ply: 1, san: 'e4', uci: 'e2z9', fenAfter: '', clockAfterMs: 0, moveTimeMs: 0, by: 'w' },
    ];
    const fen = replayToFen(corrupt, 1);
    expect(fen).toBeNull();
  });

  it('returns null for out-of-bounds ply', () => {
    expect(replayToFen(RUYLOPEZ_MOVES, -1)).toBeNull();
    expect(replayToFen(RUYLOPEZ_MOVES, 999)).toBeNull();
  });
});

describe('validateReplay', () => {
  it('returns true for a valid game', () => {
    expect(validateReplay(RUYLOPEZ_MOVES, FINAL_FEN)).toBe(true);
  });

  it('returns false when finalFen does not match replayed position', () => {
    expect(validateReplay(RUYLOPEZ_MOVES, STARTING_FEN)).toBe(false);
  });

  it('returns false for corrupt moves', () => {
    const corrupt: WireMove[] = [
      { ply: 1, san: 'e4', uci: 'e2z9', fenAfter: '', clockAfterMs: 0, moveTimeMs: 0, by: 'w' },
    ];
    expect(validateReplay(corrupt, 'anything')).toBe(false);
  });
});
