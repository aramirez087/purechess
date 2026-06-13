import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { parsePgnToTree } from '@/lib/board/pgn-parser';
import { countLines } from '@/components/openings/repertoire-import';

/**
 * Importing a known PGN must yield the expected number of leaf lines — this is
 * the count shown to the user before they save, and what S09 will drill. A line
 * = a distinct root→leaf path through the tree.
 */
describe('repertoire import — PGN → line count', () => {
  it('counts a single mainline as one line', () => {
    const { root } = parsePgnToTree('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *', Chess);
    expect(countLines(root)).toBe(1);
  });

  it('counts a branch point as two lines', () => {
    // 3. Bb5 (3. Bc4) — the variation forks the third white move into 2 leaves.
    const { root } = parsePgnToTree('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 (3. Bc4 Bc5) *', Chess);
    expect(countLines(root)).toBe(2);
  });

  it('counts multiple sibling variations', () => {
    // Three replies to 1.e4: ...e5 (main), ...c5, ...e6 — three leaf lines.
    const { root } = parsePgnToTree('1. e4 e5 (1... c5) (1... e6) *', Chess);
    expect(countLines(root)).toBe(3);
  });

  it('returns zero for an empty/moveless tree', () => {
    const { root } = parsePgnToTree('*', Chess);
    expect(countLines(root)).toBe(0);
  });

  it('a deeper nested fork yields the right leaf count', () => {
    // 1.e4 e5 2.Nf3 (2.Nc3 Nf6) Nc6 (2...Nf6) — root→leaf paths:
    //   e4 e5 Nf3 Nc6  | e4 e5 Nf3 Nf6  | e4 e5 Nc3 Nf6  = 3 lines.
    const { root } = parsePgnToTree('1. e4 e5 2. Nf3 (2. Nc3 Nf6) Nc6 (2... Nf6) *', Chess);
    expect(countLines(root)).toBe(3);
  });
});
