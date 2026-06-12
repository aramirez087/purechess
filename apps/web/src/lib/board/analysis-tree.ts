/**
 * Branching analysis tree for the /analyze board. Pure TS — no React, no
 * chess.js (callers supply SAN/UCI/FEN; the hook computes them via the lazy
 * rules module).
 *
 * Paths are plain `number[]` — indices into `children[]` at each depth,
 * `[]` = root. lila encodes paths as char-pair strings for compactness;
 * a number array is readable, JSON-serializable, and fast enough for any
 * tree a human builds by hand.
 */

export type TreePath = number[];

export interface AnalysisNode {
  /** Position after the move (or the start position for the root). */
  fen: string;
  /** SAN that led to this node; '' for root. */
  san: string;
  /** UCI that led to this node; '' for root. */
  uci: string;
  children: AnalysisNode[];
}

/**
 * Root + mainline from a played move list. Each mainline move becomes
 * `children[0]` of its predecessor.
 */
export function buildTree(
  startFen: string,
  moves: Array<{ san: string; uci: string; fenAfter: string }>,
): AnalysisNode {
  const root: AnalysisNode = { fen: startFen, san: '', uci: '', children: [] };
  let cursor = root;
  for (const m of moves) {
    const node: AnalysisNode = { fen: m.fenAfter, san: m.san, uci: m.uci, children: [] };
    cursor.children.push(node);
    cursor = node;
  }
  return root;
}

/** Walks `path` from `root`; null when any index is out of range. */
export function nodeAtPath(root: AnalysisNode, path: TreePath): AnalysisNode | null {
  let node: AnalysisNode = root;
  for (const idx of path) {
    const next = node.children[idx];
    if (!next) return null;
    node = next;
  }
  return node;
}

/**
 * Adds a move under the node at `path` (mutates the tree). If a child with
 * the same UCI already exists, navigates to it instead (transposition into
 * an explored branch). Returns the path of the resulting node, or null when
 * `path` itself is invalid.
 */
export function addMove(
  root: AnalysisNode,
  path: TreePath,
  fen: string,
  san: string,
  uci: string,
): TreePath | null {
  const parent = nodeAtPath(root, path);
  if (!parent) return null;
  const existing = parent.children.findIndex((c) => c.uci === uci);
  if (existing !== -1) return [...path, existing];
  parent.children.push({ fen, san, uci, children: [] });
  return [...path, parent.children.length - 1];
}

/** True when every step of `path` follows `children[0]` (the mainline). */
export function pathToMainline(root: AnalysisNode, path: TreePath): boolean {
  return path.every((idx) => idx === 0) && nodeAtPath(root, path) !== null;
}

/** Path of the last mainline node (walk `children[0]` until a leaf). */
export function mainlineEndPath(root: AnalysisNode): TreePath {
  const path: TreePath = [];
  let node = root;
  while (node.children[0]) {
    path.push(0);
    node = node.children[0];
  }
  return path;
}

/** Total number of moves (nodes) in the subtree rooted at `node`, excluding it. */
export function countMoves(node: AnalysisNode): number {
  let n = 0;
  for (const child of node.children) n += 1 + countMoves(child);
  return n;
}
