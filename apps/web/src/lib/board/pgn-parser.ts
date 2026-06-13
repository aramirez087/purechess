/**
 * Variation-preserving PGN parser for the /analyze board. chess.js's
 * `loadPgn()` silently drops everything in parentheses; this parser walks the
 * movetext itself and feeds `(...)` blocks, `{...}` comments and NAGs into
 * the existing `AnalysisNode` tree.
 *
 * The `Chess` class is injected by the caller so board modules can keep
 * loading chess.js lazily (see rules-lazy) — the type-only import below is
 * erased at build time.
 */
import type { Square } from '@purechess/shared';
import type { Chess } from 'chess.js';
import type { AnalysisNode } from './analysis-tree';
import type { AnnotationColor, BoardShape } from './annotations';

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** PGN shape color codes (lila/ChessBase/Scid) → our AnnotationColor. */
const COLOR_MAP: Record<string, AnnotationColor> = {
  G: 'green',
  R: 'red',
  Y: 'yellow',
  B: 'blue',
};

/**
 * Pulls `[%cal ...]` (arrows) and `[%csl ...]` (circles) directives out of a
 * comment block's text. Returns the parsed shapes plus whatever prose is left
 * once the directives are stripped (trimmed).
 *
 * Arrow token: `G{from}{to}` (e.g. `Ge2e4`). Circle token: `G{square}`
 * (e.g. `Ge4`). Unknown color codes / malformed tokens are skipped.
 */
export function parseShapesFromComment(text: string): {
  shapes: BoardShape[];
  remaining: string;
} {
  const shapes: BoardShape[] = [];
  const cleaned = text
    .replace(/\[%cal ([^\]]*)\]/g, (_, args: string) => {
      args.split(',').forEach((token) => {
        const color = COLOR_MAP[token[0]];
        if (!color) return;
        const sq = token.slice(1);
        if (sq.length === 4) {
          shapes.push({
            type: 'arrow',
            from: sq.slice(0, 2) as Square,
            to: sq.slice(2, 4) as Square,
            color,
          });
        }
      });
      return '';
    })
    .replace(/\[%csl ([^\]]*)\]/g, (_, args: string) => {
      args.split(',').forEach((token) => {
        const color = COLOR_MAP[token[0]];
        if (!color || token.length < 3) return;
        shapes.push({ type: 'circle', square: token.slice(1, 3) as Square, color });
      });
      return '';
    })
    .trim();
  return { shapes, remaining: cleaned };
}

const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

/** Inline annotation glyphs → standard NAG numbers. */
const GLYPH_NAGS: Record<string, number> = {
  '!': 1,
  '?': 2,
  '!!': 3,
  '??': 4,
  '!?': 5,
  '?!': 6,
};

/** Characters that can appear in a SAN / move-number / result word. */
function isWordChar(c: string): boolean {
  return /[A-Za-z0-9.=+#/-]/.test(c);
}

/**
 * Splits movetext into tokens: `(` `)`, whole `{...}` comments, `$N` NAGs,
 * inline glyphs (`!`, `??`, …), move numbers, SAN words, result markers.
 * `;` line comments and whitespace are skipped.
 */
export function tokenizeMovetext(movetext: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < movetext.length) {
    const c = movetext[i];
    if (/\s/.test(c)) {
      i += 1;
    } else if (c === ';') {
      while (i < movetext.length && movetext[i] !== '\n') i += 1;
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
    } else if (c === '!' || c === '?') {
      const pair = movetext.slice(i, i + 2);
      if (GLYPH_NAGS[pair] !== undefined) {
        tokens.push(pair);
        i += 2;
      } else {
        tokens.push(c);
        i += 1;
      }
    } else if (isWordChar(c)) {
      let j = i + 1;
      while (j < movetext.length && isWordChar(movetext[j])) j += 1;
      tokens.push(movetext.slice(i, j));
      i = j;
    } else {
      i += 1; // stray character — skip
    }
  }
  return tokens;
}

/**
 * Collects `[Key "Value"]` tag pairs until the first blank line or first
 * non-tag line; everything after is movetext.
 */
export function parseHeaders(pgn: string): {
  headers: Map<string, string>;
  movetext: string;
} {
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

/** Plays `tok` on `chess`; null when the move is invalid. */
function tryMove(chess: Chess, tok: string) {
  try {
    return chess.move(tok); // chess.js parses permissively (e8Q, e2e4, …)
  } catch {
    // Last resort: coordinate notation that even permissive parsing missed.
    const uci = /^([a-h][1-8])([a-h][1-8])([qrbnQRBN])?$/.exec(tok);
    if (!uci) return null;
    try {
      return chess.move({ from: uci[1], to: uci[2], promotion: uci[3]?.toLowerCase() });
    } catch {
      return null;
    }
  }
}

/**
 * Consumes `tokens` (mutating via shift) into children of `parentNode`.
 * `fen` is the position at `parentNode`. Variations branch off the position
 * BEFORE the most recent move — its parent node, tracked as `anchor`.
 */
export function parseVariation(
  tokens: string[],
  parentNode: AnalysisNode,
  fen: string,
  ChessClass: typeof Chess,
): void {
  const chess = new ChessClass(fen);
  let prev = parentNode; // last node played in this frame
  let anchor = parentNode; // node the last move was played from

  while (tokens.length > 0) {
    const tok = tokens.shift()!;

    if (tok === ')') return;

    if (tok === '(') {
      // Alternative to prev's move — extend prev's parent, not prev.
      parseVariation(tokens, anchor, anchor.fen, ChessClass);
      continue;
    }

    if (tok.startsWith('{')) {
      if (prev !== parentNode) {
        const raw = tok.replace(/^\{/, '').replace(/\}$/, '').trim();
        const { shapes, remaining } = parseShapesFromComment(raw);
        if (shapes.length > 0) prev.shapes = prev.shapes ? [...prev.shapes, ...shapes] : shapes;
        if (remaining) prev.comment = prev.comment ? `${prev.comment} ${remaining}` : remaining;
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

    if (/^\d+\.*$/.test(tok) || /^\.+$/.test(tok)) continue; // move number marker

    const result = tryMove(chess, tok);
    if (!result) continue; // invalid move — skip, keep parsing

    const node: AnalysisNode = {
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
 * Full PGN → analysis tree. The mainline is each node's `children[0]`;
 * variations are the later siblings. Comments and NAGs land on the node of
 * the move they follow. A `[FEN "..."]` header seeds the root position.
 */
export function parsePgnToTree(
  pgn: string,
  ChessClass: typeof Chess,
): { root: AnalysisNode; headers: Map<string, string> } {
  const { headers, movetext } = parseHeaders(pgn);

  let rootFen = STARTING_FEN;
  const fenHeader = headers.get('FEN');
  if (fenHeader) {
    try {
      rootFen = new ChessClass(fenHeader).fen(); // validate + pad 4-field FENs
    } catch {
      rootFen = STARTING_FEN;
    }
  }

  const root: AnalysisNode = { fen: rootFen, san: '', uci: '', children: [] };
  parseVariation(tokenizeMovetext(movetext), root, root.fen, ChessClass);
  return { root, headers };
}
