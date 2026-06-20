import { describe, it, expect } from 'vitest';
import { mergeTrees } from '@/lib/board/merge-trees';
import { buildTree, type AnalysisNode } from '@/lib/board/analysis-tree';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function node(fen: string, san: string, uci: string, children: AnalysisNode[] = []): AnalysisNode {
  return { fen, san, uci, children };
}

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

describe('mergeTrees', () => {
  it('adds a new branch from source onto target', () => {
    const target = buildTree(START, []);
    const source = node(START, '', '', [
      node(AFTER_E4, 'e4', 'e2e4', [node(AFTER_E5, 'e5', 'e7e5', [])]),
    ]);
    mergeTrees(target, source);
    expect(target.children).toHaveLength(1);
    expect(target.children[0].san).toBe('e4');
    expect(target.children[0].children[0].san).toBe('e5');
  });

  it('merges deeper when UCI matches', () => {
    const target = buildTree(START, []);
    target.children.push(node(AFTER_E4, 'e4', 'e2e4', []));
    const source = node(START, '', '', [
      node(AFTER_E4, 'e4', 'e2e4', [node(AFTER_E5, 'e5', 'e7e5', [])]),
    ]);
    mergeTrees(target, source);
    expect(target.children[0].children).toHaveLength(1);
    expect(target.children[0].children[0].san).toBe('e5');
  });
});