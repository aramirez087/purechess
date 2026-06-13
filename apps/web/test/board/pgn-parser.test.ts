import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { nodeAtPath } from '@/lib/board/analysis-tree';
import { parseHeaders, parsePgnToTree, tokenizeMovetext } from '@/lib/board/pgn-parser';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('tokenizeMovetext', () => {
  it('keeps a braced comment as one token and splits glued glyphs off SAN', () => {
    const tokens = tokenizeMovetext('1. e4 e5?? { weak } 2. Nf3!');
    expect(tokens).toEqual(['1.', 'e4', 'e5', '??', '{ weak }', '2.', 'Nf3', '!']);
  });

  it('skips ; line comments', () => {
    const tokens = tokenizeMovetext('1. e4 ; king pawn\ne5');
    expect(tokens).toEqual(['1.', 'e4', 'e5']);
  });
});

describe('parseHeaders', () => {
  it('collects tag pairs and returns the rest as movetext', () => {
    const { headers, movetext } = parseHeaders('[White "A"]\n[Black "B"]\n\n1. e4 e5');
    expect(headers.get('White')).toBe('A');
    expect(headers.get('Black')).toBe('B');
    expect(movetext.trim()).toBe('1. e4 e5');
  });
});

describe('parsePgnToTree', () => {
  it('mainline-only PGN produces a single chain', () => {
    const { root } = parsePgnToTree('1. e4 e5 2. Nf3 Nc6', Chess);
    expect(root.fen).toBe(STARTING_FEN);
    let node = root;
    const sans: string[] = [];
    while (node.children.length > 0) {
      expect(node.children).toHaveLength(1);
      node = node.children[0];
      sans.push(node.san);
    }
    expect(sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('a variation becomes a sibling of the move it replaces', () => {
    const { root } = parsePgnToTree('1. e4 e5 (1... c5 2. Nf3) 2. Nf3', Chess);
    expect(root.children).toHaveLength(1); // e4 is the only first move
    const e4 = root.children[0];
    expect(e4.children.map((c) => c.san)).toEqual(['e5', 'c5']);
    expect(e4.children[0].children.map((c) => c.san)).toEqual(['Nf3']); // mainline continues
    expect(e4.children[1].children.map((c) => c.san)).toEqual(['Nf3']); // variation line
  });

  it('nested variations three levels deep are all reachable via tree paths', () => {
    const { root } = parsePgnToTree('1. e4 e5 (1... c5 2. Nf3 (2. c3 d5 (2... Nc6)))', Chess);
    expect(nodeAtPath(root, [0, 0])?.san).toBe('e5');
    expect(nodeAtPath(root, [0, 1])?.san).toBe('c5'); // level 1
    expect(nodeAtPath(root, [0, 1, 0])?.san).toBe('Nf3');
    expect(nodeAtPath(root, [0, 1, 1])?.san).toBe('c3'); // level 2
    expect(nodeAtPath(root, [0, 1, 1, 0])?.san).toBe('d5');
    expect(nodeAtPath(root, [0, 1, 1, 1])?.san).toBe('Nc6'); // level 3
  });

  it('attaches $N NAGs to the move they follow, not its parent', () => {
    const { root } = parsePgnToTree('1. e4 e5 $4 2. Nf3', Chess);
    const e4 = root.children[0];
    const e5 = e4.children[0];
    expect(e4.nag).toBeUndefined();
    expect(e5.nag).toBe(4);
  });

  it('maps the inline ?? glyph to nag 4', () => {
    const { root } = parsePgnToTree('1. e4 f5?? 2. exf5', Chess);
    const f5 = root.children[0].children[0];
    expect(f5.san).toBe('f5');
    expect(f5.nag).toBe(4);
  });

  it('attaches a braced comment to the move it follows', () => {
    const { root } = parsePgnToTree('1. e4 e5 2. Nf3 Nc6 3. Bb5 { Ruy Lopez } a6', Chess);
    const bb5 = nodeAtPath(root, [0, 0, 0, 0, 0]);
    expect(bb5?.san).toBe('Bb5');
    expect(bb5?.comment).toBe('Ruy Lopez');
  });

  it('seeds the root from a [FEN] header', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const pgn = `[FEN "${fen}"]\n[SetUp "1"]\n\n3. Bb5 a6`;
    const { root, headers } = parsePgnToTree(pgn, Chess);
    expect(root.fen).toBe(fen);
    expect(headers.get('SetUp')).toBe('1');
    expect(root.children[0].san).toBe('Bb5');
  });

  it('skips an invalid move inside a variation and keeps parsing', () => {
    const { root } = parsePgnToTree('1. e4 e5 (1... Zz9 c5) 2. Nf3', Chess);
    const e4 = root.children[0];
    expect(e4.children.map((c) => c.san)).toEqual(['e5', 'c5']); // Zz9 dropped
    expect(e4.children[0].children.map((c) => c.san)).toEqual(['Nf3']);
  });

  it('stops at a result marker', () => {
    const { root } = parsePgnToTree('1. e4 e5 1-0 2. Nf3', Chess);
    const e5 = root.children[0].children[0];
    expect(e5.san).toBe('e5');
    expect(e5.children).toHaveLength(0);
  });

  it('parses a [%cal] arrow out of a comment', () => {
    const { root } = parsePgnToTree('1. e4 {[%cal Gf3e5]}', Chess);
    const e4 = root.children[0];
    expect(e4.shapes).toEqual([{ type: 'arrow', from: 'f3', to: 'e5', color: 'green' }]);
    expect(e4.comment).toBeUndefined();
  });

  it('parses a [%csl] circle out of a comment', () => {
    const { root } = parsePgnToTree('1. e4 {[%csl Ye4]}', Chess);
    const e4 = root.children[0];
    expect(e4.shapes).toEqual([{ type: 'circle', square: 'e4', color: 'yellow' }]);
    expect(e4.comment).toBeUndefined();
  });

  it('keeps the prose when a comment mixes a directive and text', () => {
    const { root } = parsePgnToTree('1. e4 {[%cal Re4d4] Ruy Lopez}', Chess);
    const e4 = root.children[0];
    expect(e4.shapes).toEqual([{ type: 'arrow', from: 'e4', to: 'd4', color: 'red' }]);
    expect(e4.comment).toBe('Ruy Lopez');
  });

  it('parses both directives in one comment with no prose left', () => {
    const { root } = parsePgnToTree('1. e4 {[%cal Ge2e4][%csl Ge4]}', Chess);
    const e4 = root.children[0];
    expect(e4.shapes).toEqual([
      { type: 'arrow', from: 'e2', to: 'e4', color: 'green' },
      { type: 'circle', square: 'e4', color: 'green' },
    ]);
    expect(e4.comment).toBeUndefined();
  });
});
