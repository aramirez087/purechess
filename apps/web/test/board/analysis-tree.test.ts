import { describe, expect, it } from 'vitest';
import {
  buildTree,
  nodeAtPath,
  addMove,
  pathToMainline,
  mainlineEndPath,
  countMoves,
} from '@/lib/board/analysis-tree';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq e3 0 1';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 2';
const AFTER_C5 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPPPPPP/RNBQKBNR w KQkq c6 0 2';

const MAINLINE = [
  { san: 'e4', uci: 'e2e4', fenAfter: AFTER_E4 },
  { san: 'e5', uci: 'e7e5', fenAfter: AFTER_E5 },
];

describe('buildTree', () => {
  it('builds root + mainline as a children[0] chain', () => {
    const root = buildTree(START, MAINLINE);
    expect(root.fen).toBe(START);
    expect(root.san).toBe('');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].san).toBe('e4');
    expect(root.children[0].children[0].san).toBe('e5');
    expect(root.children[0].children[0].fen).toBe(AFTER_E5);
    expect(root.children[0].children[0].children).toHaveLength(0);
  });

  it('handles an empty move list (bare position)', () => {
    const root = buildTree(START, []);
    expect(root.children).toHaveLength(0);
  });
});

describe('nodeAtPath', () => {
  const root = buildTree(START, MAINLINE);

  it('returns root for []', () => {
    expect(nodeAtPath(root, [])).toBe(root);
  });

  it('walks indices', () => {
    expect(nodeAtPath(root, [0, 0])?.san).toBe('e5');
  });

  it('returns null when an index is out of range', () => {
    expect(nodeAtPath(root, [1])).toBeNull();
    expect(nodeAtPath(root, [0, 0, 0])).toBeNull();
  });
});

describe('addMove', () => {
  it('appends a new branch and returns its path', () => {
    const root = buildTree(START, MAINLINE);
    const path = addMove(root, [0], AFTER_C5, 'c5', 'c7c5');
    expect(path).toEqual([0, 1]);
    expect(root.children[0].children).toHaveLength(2);
    expect(root.children[0].children[1].san).toBe('c5');
  });

  it('dedupes a transposition into an existing child', () => {
    const root = buildTree(START, MAINLINE);
    const path = addMove(root, [0], AFTER_E5, 'e5', 'e7e5');
    expect(path).toEqual([0, 0]);
    expect(root.children[0].children).toHaveLength(1);
  });

  it('dedupes into an existing variation child too', () => {
    const root = buildTree(START, MAINLINE);
    addMove(root, [0], AFTER_C5, 'c5', 'c7c5');
    const again = addMove(root, [0], AFTER_C5, 'c5', 'c7c5');
    expect(again).toEqual([0, 1]);
    expect(root.children[0].children).toHaveLength(2);
  });

  it('returns null for an invalid parent path', () => {
    const root = buildTree(START, MAINLINE);
    expect(addMove(root, [5], AFTER_C5, 'c5', 'c7c5')).toBeNull();
  });
});

describe('pathToMainline', () => {
  it('is true for all-zero valid paths', () => {
    const root = buildTree(START, MAINLINE);
    expect(pathToMainline(root, [])).toBe(true);
    expect(pathToMainline(root, [0])).toBe(true);
    expect(pathToMainline(root, [0, 0])).toBe(true);
  });

  it('is false off the mainline or past it', () => {
    const root = buildTree(START, MAINLINE);
    addMove(root, [0], AFTER_C5, 'c5', 'c7c5');
    expect(pathToMainline(root, [0, 1])).toBe(false);
    expect(pathToMainline(root, [0, 0, 0])).toBe(false);
  });
});

describe('mainlineEndPath', () => {
  it('walks children[0] to the leaf', () => {
    const root = buildTree(START, MAINLINE);
    expect(mainlineEndPath(root)).toEqual([0, 0]);
  });

  it('is [] for a bare position', () => {
    expect(mainlineEndPath(buildTree(START, []))).toEqual([]);
  });
});

describe('countMoves', () => {
  it('counts all nodes in the subtree', () => {
    const root = buildTree(START, MAINLINE);
    addMove(root, [0], AFTER_C5, 'c5', 'c7c5');
    expect(countMoves(root)).toBe(3);
    expect(countMoves(root.children[0])).toBe(2);
  });
});
