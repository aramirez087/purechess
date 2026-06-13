import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import type { AnalysisNode } from '@/lib/board/analysis-tree';
import { parsePgnToTree } from '@/lib/board/pgn-parser';
import { exportTreeToPgn } from '@/lib/board/pgn-export';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Movetext = everything after the header block's blank line. */
function movetextOf(pgn: string): string {
  const idx = pgn.indexOf('\n\n');
  return pgn.slice(idx + 2).trim();
}

/** Structural snapshot for round-trip comparison. */
function snapshot(n: AnalysisNode): unknown {
  return {
    fen: n.fen,
    san: n.san,
    uci: n.uci,
    nag: n.nag,
    comment: n.comment,
    shapes: n.shapes,
    children: n.children.map(snapshot),
  };
}

describe('exportTreeToPgn', () => {
  it('mainline only produces standard PGN with no extra tokens', () => {
    const { root } = parsePgnToTree('1. e4 e5 2. Nf3 Nc6', Chess);
    const pgn = exportTreeToPgn(root);
    const movetext = movetextOf(pgn);
    expect(movetext).toBe('1. e4 e5 2. Nf3 Nc6 *');
    expect(movetext).not.toMatch(/[(){}$]/);
  });

  it('emits a variation in parentheses after the move it replaces', () => {
    const { root } = parsePgnToTree('1. e4 e5 (1... c5 2. Nf3) 2. Nf3', Chess);
    expect(movetextOf(exportTreeToPgn(root))).toBe('1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *');
  });

  it('emits a $N NAG after the move', () => {
    const { root } = parsePgnToTree('1. e4 e5 $4', Chess);
    expect(movetextOf(exportTreeToPgn(root))).toBe('1. e4 e5 $4 *');
  });

  it('emits a shape as a { [%cal ...] } comment block', () => {
    const root: AnalysisNode = {
      fen: STARTING_FEN,
      san: '',
      uci: '',
      children: [
        {
          fen: 'after-e4',
          san: 'e4',
          uci: 'e2e4',
          children: [],
          shapes: [{ type: 'arrow', from: 'e2', to: 'e4', color: 'green' }],
        },
      ],
    };
    expect(movetextOf(exportTreeToPgn(root))).toBe('1. e4 { [%cal Ge2e4] } *');
  });

  it('emits shapes before comment text in one block', () => {
    const root: AnalysisNode = {
      fen: STARTING_FEN,
      san: '',
      uci: '',
      children: [
        {
          fen: 'after-e4',
          san: 'e4',
          uci: 'e2e4',
          children: [],
          comment: 'Best by test',
          shapes: [
            { type: 'arrow', from: 'e2', to: 'e4', color: 'green' },
            { type: 'circle', square: 'e4', color: 'yellow' },
          ],
        },
      ],
    };
    expect(movetextOf(exportTreeToPgn(root))).toBe(
      '1. e4 { [%cal Ge2e4][%csl Ye4] Best by test } *',
    );
  });

  it('uses provided headers and result', () => {
    const { root } = parsePgnToTree('1. e4 e5', Chess);
    const pgn = exportTreeToPgn(root, {
      Event: 'Test',
      White: 'Alice',
      Black: 'Bob',
      Result: '1-0',
    });
    expect(pgn).toContain('[White "Alice"]');
    expect(pgn).toContain('[Black "Bob"]');
    expect(movetextOf(pgn)).toBe('1. e4 e5 1-0');
  });

  it('round-trips variations, NAGs, comments, and shapes', () => {
    const pgn =
      '1. e4 e5 (1... c5 2. Nf3 Nc6) 2. Nf3 Nc6 $1 ' +
      '{ [%cal Gf3e5][%csl Ye5] Knight eyes e5 } 3. Bb5';
    const { root: first } = parsePgnToTree(pgn, Chess);
    const { root: second } = parsePgnToTree(exportTreeToPgn(first), Chess);
    expect(snapshot(second)).toEqual(snapshot(first));
  });
});
