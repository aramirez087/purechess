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
import {
  STARTING_FEN,
  parseHeaders,
  tokenizeMovetext,
  walkMoveVariation,
} from '@purechess/shared';
import type { Chess } from 'chess.js';
import type { AnalysisNode } from './analysis-tree';
import type { AnnotationColor, BoardShape } from './annotations';

// Re-export shared utilities so existing callers keep their import paths.
export { STARTING_FEN, parseHeaders, tokenizeMovetext };

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
  walkMoveVariation<AnalysisNode>(
    tokens,
    parentNode,
    (startFen) => {
      const chess = new ChessClass(startFen);
      return {
        tryMove: (tok) => {
          // chess.js parses SAN permissively; fall back to coordinate notation.
          try {
            const m = chess.move(tok);
            return { fen: chess.fen(), san: m.san, uci: m.from + m.to + (m.promotion ?? '') };
          } catch {
            const coord = /^([a-h][1-8])([a-h][1-8])([qrbnQRBN])?$/.exec(tok);
            if (!coord) return null;
            try {
              const m = chess.move({
                from: coord[1],
                to: coord[2],
                promotion: coord[3]?.toLowerCase(),
              });
              return { fen: chess.fen(), san: m.san, uci: m.from + m.to + (m.promotion ?? '') };
            } catch {
              return null;
            }
          }
        },
        makeNode: (nodeFen, san, uci) => ({ fen: nodeFen, san, uci, children: [] }),
        onComment: (node, raw) => {
          const { shapes, remaining } = parseShapesFromComment(raw);
          if (shapes.length > 0)
            node.shapes = node.shapes ? [...node.shapes, ...shapes] : shapes;
          if (remaining)
            node.comment = node.comment ? `${node.comment} ${remaining}` : remaining;
        },
        onNag: (node, nag) => {
          node.nag = nag;
        },
      };
    },
    fen,
  );
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
