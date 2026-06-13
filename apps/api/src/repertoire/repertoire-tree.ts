/**
 * Server-side helpers for the repertoire move tree.
 *
 * The tree is the SAME `AnalysisNode` shape the web /analyze board uses
 * (`apps/web/src/lib/board/analysis-tree.ts`), serialized into `Repertoire.treeJson`.
 * This file does NOT live in the engine path (`src/chess/engine/`) — it uses
 * chess.js only for FEN/move legality of the data the user is importing, and
 * the engine coverage gate must not see it.
 *
 * Parse-side decision: PGN→tree is parsed CLIENT-SIDE by the web app (which
 * already owns the variation-preserving parser) and the pre-built tree is sent
 * to the server. The server re-validates: structure, the root FEN's legality,
 * and the legality of a SAMPLED set of move nodes (full validation of a
 * 5000-node megabase on every write is wasteful). A raw-PGN import path is also
 * provided here for completeness (`parsePgnToTree`), used only when the client
 * sends `pgn` instead of `tree`.
 */
import { Chess } from 'chess.js';
import type { RepertoireNodeDto, RepertoireShapeDto } from '@purechess/shared';

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Hard cap on tree size so a pasted megabase can't bloat a row. */
export const MAX_TREE_NODES = 5000;

/** How many move nodes (beyond the root) to spot-check for legality on write. */
export const SAMPLE_NODE_COUNT = 40;

export class RepertoireTreeError extends Error {}

/** True when `fen` is a legal position chess.js can load. */
export function isLegalFen(fen: string): boolean {
  if (typeof fen !== 'string' || fen.trim() === '') return false;
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

/**
 * Total move nodes in the subtree rooted at `node`, excluding it. Iterative —
 * a deep megabase chain must not overflow the call stack.
 */
export function countNodes(node: RepertoireNodeDto): number {
  let n = 0;
  const stack: RepertoireNodeDto[] = [node];
  while (stack.length > 0) {
    const cur = stack.pop() as RepertoireNodeDto;
    for (const child of cur.children) {
      n += 1;
      stack.push(child);
    }
  }
  return n;
}

/** Number of leaf lines (distinct root→leaf paths). A bare root counts as 0. */
export function countLines(node: RepertoireNodeDto): number {
  if (node.children.length === 0) return 0;
  let n = 0;
  const stack: RepertoireNodeDto[] = [...node.children];
  while (stack.length > 0) {
    const cur = stack.pop() as RepertoireNodeDto;
    if (cur.children.length === 0) n += 1;
    else for (const child of cur.children) stack.push(child);
  }
  return n;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Checks one node's own fields (not its children). Throws on a problem. */
function checkNodeFields(node: unknown): asserts node is Record<string, unknown> {
  if (!isPlainObject(node)) {
    throw new RepertoireTreeError('Tree node must be an object.');
  }
  if (typeof node.fen !== 'string' || node.fen.trim() === '') {
    throw new RepertoireTreeError('Tree node is missing a FEN.');
  }
  if (typeof node.san !== 'string' || typeof node.uci !== 'string') {
    throw new RepertoireTreeError('Tree node san/uci must be strings.');
  }
  if (!Array.isArray(node.children)) {
    throw new RepertoireTreeError('Tree node children must be an array.');
  }
  if (node.comment !== undefined && typeof node.comment !== 'string') {
    throw new RepertoireTreeError('Tree node comment must be a string.');
  }
  if (node.nag !== undefined && typeof node.nag !== 'number') {
    throw new RepertoireTreeError('Tree node nag must be a number.');
  }
  if (node.shapes !== undefined && !Array.isArray(node.shapes)) {
    throw new RepertoireTreeError('Tree node shapes must be an array.');
  }
}

/**
 * Structural validation of a node and its subtree (no chess legality — that is
 * sampled separately). Iterative so a deep megabase can't overflow the stack;
 * enforces the node cap during the walk. Returns the total node count.
 */
function validateNodeShape(root: unknown): number {
  checkNodeFields(root);
  let count = 0;
  const stack: Record<string, unknown>[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as Record<string, unknown>;
    const children = node.children as unknown[];
    count += children.length;
    if (count > MAX_TREE_NODES) {
      throw new RepertoireTreeError(
        `Repertoire is too large (over ${MAX_TREE_NODES} moves).`,
      );
    }
    for (const child of children) {
      checkNodeFields(child);
      stack.push(child as Record<string, unknown>);
    }
  }
  return count;
}

/** Collects up to `limit` non-root nodes paired with their parent FEN. */
function collectSamples(
  node: RepertoireNodeDto,
  out: Array<{ parentFen: string; uci: string; san: string }>,
  limit: number,
): void {
  for (const child of node.children) {
    if (out.length >= limit) return;
    out.push({ parentFen: node.fen, uci: child.uci, san: child.san });
    collectSamples(child, out, limit);
  }
}

/** True when playing `uci`/`san` from `parentFen` is a legal chess move. */
function isLegalEdge(parentFen: string, uci: string, san: string): boolean {
  try {
    const chess = new Chess(parentFen);
    if (uci && /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(uci)) {
      chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4].toLowerCase() : undefined,
      });
      return true;
    }
    // Fall back to SAN when UCI is absent/malformed (still must be legal).
    if (san) {
      chess.move(san);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export interface ValidatedTree {
  tree: RepertoireNodeDto;
  rootFen: string;
  nodeCount: number;
  lineCount: number;
}

/**
 * Validates a (possibly untrusted) tree for persistence:
 *  - it parses as the expected structure,
 *  - the root FEN is a legal position,
 *  - the total node count is within `MAX_TREE_NODES`,
 *  - a sampled set of edges are legal chess moves.
 * Throws `RepertoireTreeError` on any failure. Returns the normalized tree plus
 * derived counts.
 */
export function validateTree(input: unknown): ValidatedTree {
  const nodeCount = validateNodeShape(input); // also enforces the cap
  const tree = input as RepertoireNodeDto;
  if (!isLegalFen(tree.fen)) {
    throw new RepertoireTreeError('Repertoire root position is not a legal FEN.');
  }
  const samples: Array<{ parentFen: string; uci: string; san: string }> = [];
  collectSamples(tree, samples, SAMPLE_NODE_COUNT);
  for (const s of samples) {
    if (!isLegalEdge(s.parentFen, s.uci, s.san)) {
      throw new RepertoireTreeError(
        `Repertoire contains an illegal move (${s.san || s.uci || '?'}).`,
      );
    }
  }
  return { tree, rootFen: tree.fen, nodeCount, lineCount: countLines(tree) };
}

// --- Raw-PGN → tree (server-side fallback when the client sends `pgn`) -------
//
// A compact port of the web parser's essentials: enough to turn a single line
// or a variation-bearing PGN into the AnalysisNode tree. Move numbers/results
// are skipped; comments, NAGs and shape directives are NOT parsed here (the
// preferred client path keeps those — this is a convenience fallback).

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*']);
const SHAPE_COLORS: Record<string, RepertoireShapeDto['color']> = {
  G: 'green',
  R: 'red',
  Y: 'yellow',
  B: 'blue',
};

function isWordChar(c: string): boolean {
  return /[A-Za-z0-9.=+#/-]/.test(c);
}

/** Splits movetext into `(`/`)`, `{...}`, `$N`, move words and result markers. */
function tokenize(movetext: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < movetext.length) {
    const c = movetext[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (c === '{') {
      let j = i + 1;
      while (j < movetext.length && movetext[j] !== '}') j += 1;
      tokens.push(movetext.slice(i, Math.min(j + 1, movetext.length)));
      i = j + 1;
    } else if (c === '(' || c === ')' || c === '*') {
      tokens.push(c);
      i += 1;
    } else if (c === '$') {
      let j = i + 1;
      while (j < movetext.length && /\d/.test(movetext[j])) j += 1;
      tokens.push(movetext.slice(i, j));
      i = j;
    } else if (isWordChar(c)) {
      let j = i + 1;
      while (j < movetext.length && isWordChar(movetext[j])) j += 1;
      tokens.push(movetext.slice(i, j));
      i = j;
    } else {
      i += 1;
    }
  }
  return tokens;
}

function parseHeaders(pgn: string): { headers: Map<string, string>; movetext: string } {
  const headers = new Map<string, string>();
  const lines = pgn.split('\n');
  let start = 0;
  for (; start < lines.length; start++) {
    const line = lines[start].trim();
    if (line === '') continue;
    const tag = /^\[(\w+)\s+"(.*)"\]$/.exec(line);
    if (!tag) break;
    headers.set(tag[1], tag[2]);
  }
  return { headers, movetext: lines.slice(start).join('\n') };
}

function tryMove(chess: Chess, tok: string): { san: string; from: string; to: string; promotion?: string } | null {
  try {
    const m = chess.move(tok);
    return { san: m.san, from: m.from, to: m.to, promotion: m.promotion };
  } catch {
    const uci = /^([a-h][1-8])([a-h][1-8])([qrbnQRBN])?$/.exec(tok);
    if (!uci) return null;
    try {
      const m = chess.move({ from: uci[1], to: uci[2], promotion: uci[3]?.toLowerCase() });
      return { san: m.san, from: m.from, to: m.to, promotion: m.promotion };
    } catch {
      return null;
    }
  }
}

function parseShapes(raw: string): RepertoireShapeDto[] {
  const shapes: RepertoireShapeDto[] = [];
  raw.replace(/\[%cal ([^\]]*)\]/g, (_m, args: string) => {
    args.split(',').forEach((t) => {
      const color = SHAPE_COLORS[t[0]];
      const sq = t.slice(1);
      if (color && sq.length === 4) {
        shapes.push({ type: 'arrow', from: sq.slice(0, 2), to: sq.slice(2, 4), color });
      }
    });
    return '';
  });
  raw.replace(/\[%csl ([^\]]*)\]/g, (_m, args: string) => {
    args.split(',').forEach((t) => {
      const color = SHAPE_COLORS[t[0]];
      if (color && t.length >= 3) shapes.push({ type: 'circle', square: t.slice(1, 3), color });
    });
    return '';
  });
  return shapes;
}

const GLYPH_NAGS: Record<string, number> = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };

function parseVariation(
  tokens: string[],
  parentNode: RepertoireNodeDto,
  fen: string,
): void {
  const chess = new Chess(fen);
  let prev = parentNode;
  let anchor = parentNode;
  while (tokens.length > 0) {
    const tok = tokens.shift() as string;
    if (tok === ')') return;
    if (tok === '(') {
      parseVariation(tokens, anchor, anchor.fen);
      continue;
    }
    if (tok.startsWith('{')) {
      if (prev !== parentNode) {
        const raw = tok.replace(/^\{/, '').replace(/\}$/, '').trim();
        const shapes = parseShapes(raw);
        if (shapes.length > 0) prev.shapes = prev.shapes ? [...prev.shapes, ...shapes] : shapes;
        const text = raw.replace(/\[%c[as]l [^\]]*\]/g, '').trim();
        if (text) prev.comment = prev.comment ? `${prev.comment} ${text}` : text;
      }
      continue;
    }
    if (tok.startsWith('$')) {
      const n = Number.parseInt(tok.slice(1), 10);
      if (prev !== parentNode && Number.isFinite(n) && prev.nag === undefined) prev.nag = n;
      continue;
    }
    if (GLYPH_NAGS[tok] !== undefined) {
      if (prev !== parentNode && prev.nag === undefined) prev.nag = GLYPH_NAGS[tok];
      continue;
    }
    if (RESULT_TOKENS.has(tok)) return;
    if (/^\d+\.*$/.test(tok) || /^\.+$/.test(tok)) continue;
    const result = tryMove(chess, tok);
    if (!result) continue;
    const node: RepertoireNodeDto = {
      fen: chess.fen(),
      san: result.san,
      uci: result.from + result.to + (result.promotion ?? ''),
      children: [],
    };
    prev.children.push(node);
    anchor = prev;
    prev = node;
  }
}

/**
 * Server-side PGN → AnalysisNode tree. Only used when the client posts `pgn`
 * instead of a pre-built `tree`. Throws `RepertoireTreeError` when the PGN
 * yields no moves and has no `[FEN]` header.
 */
export function parsePgnToTree(pgn: string): RepertoireNodeDto {
  const { headers, movetext } = parseHeaders(pgn);
  let rootFen = STARTING_FEN;
  const fenHeader = headers.get('FEN');
  if (fenHeader) {
    try {
      rootFen = new Chess(fenHeader).fen();
    } catch {
      rootFen = STARTING_FEN;
    }
  }
  const root: RepertoireNodeDto = { fen: rootFen, san: '', uci: '', children: [] };
  parseVariation(tokenize(movetext), root, root.fen);
  if (root.children.length === 0 && !fenHeader) {
    throw new RepertoireTreeError('No legal moves found in PGN.');
  }
  return root;
}
