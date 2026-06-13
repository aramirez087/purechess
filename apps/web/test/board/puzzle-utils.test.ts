import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  isSolverTurn,
  normalizeCastleUci,
  replayPgnToFen,
  replayPgnVerbose,
  uciMatch,
} from '@/lib/board/puzzle-utils';

describe('replayPgnToFen', () => {
  it('returns the FEN after the requested ply count', () => {
    const expected = (() => {
      const c = new Chess();
      c.move('e4');
      c.move('e5');
      return c.fen();
    })();
    expect(replayPgnToFen('1. e4 e5', 2)).toBe(expected);
  });

  it('returns the start position for plyCount 0', () => {
    expect(replayPgnToFen('1. e4 e5', 0)).toBe(new Chess().fen());
  });

  it('returns null when the PGN is shorter than plyCount', () => {
    expect(replayPgnToFen('1. e4 e5', 5)).toBeNull();
  });

  it('returns null for an unparseable PGN', () => {
    expect(replayPgnToFen('not a real pgn ###', 2)).toBeNull();
  });
});

describe('replayPgnVerbose', () => {
  it('returns each ply with from/to and the FEN after it', () => {
    const plies = replayPgnVerbose('1. e4 e5 2. Nf3');
    expect(plies).not.toBeNull();
    expect(plies).toHaveLength(3);
    expect(plies![0]).toMatchObject({ from: 'e2', to: 'e4' });
    expect(plies![2]).toMatchObject({ from: 'g1', to: 'f3' });
  });
});

describe('isSolverTurn', () => {
  it('is true on even indices, false on odd', () => {
    expect(isSolverTurn(0)).toBe(true);
    expect(isSolverTurn(1)).toBe(false);
    expect(isSolverTurn(2)).toBe(true);
  });
});

describe('normalizeCastleUci', () => {
  it('maps rook-square castles to king-destination form', () => {
    expect(normalizeCastleUci('e1h1')).toBe('e1g1');
    expect(normalizeCastleUci('e8h8')).toBe('e8g8');
    expect(normalizeCastleUci('e1a1')).toBe('e1c1');
    expect(normalizeCastleUci('e8a8')).toBe('e8c8');
  });

  it('passes non-castling UCIs through unchanged', () => {
    expect(normalizeCastleUci('e2e4')).toBe('e2e4');
  });
});

describe('uciMatch', () => {
  it('treats castle forms as equivalent', () => {
    expect(uciMatch('e1h1', 'e1g1')).toBe(true);
    expect(uciMatch('e1g1', 'e1h1')).toBe(true);
  });

  it('is false for different moves', () => {
    expect(uciMatch('e2e4', 'd7d5')).toBe(false);
  });
});
