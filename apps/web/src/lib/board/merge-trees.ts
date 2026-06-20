import type { AnalysisNode } from './analysis-tree';

/** First 4 FEN fields — transpositions may differ only in move counters. */
function epd(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function cloneSubtree(node: AnalysisNode): AnalysisNode {
  return {
    fen: node.fen,
    san: node.san,
    uci: node.uci,
    comment: node.comment,
    nag: node.nag,
    shapes: node.shapes ? [...node.shapes] : undefined,
    children: node.children.map(cloneSubtree),
  };
}

/**
 * Merges `source` into `target` in place. Matching children are found by UCI;
 * new branches are deep-cloned onto `target`. Roots must be the same position
 * (EPD match).
 */
export function mergeTrees(target: AnalysisNode, source: AnalysisNode): void {
  if (epd(target.fen) !== epd(source.fen)) return;
  for (const child of source.children) {
    const existing = target.children.find((c) => c.uci === child.uci);
    if (existing) mergeTrees(existing, child);
    else target.children.push(cloneSubtree(child));
  }
}