/**
 * Shared PGN tokenizing / movetext-walking utilities.
 *
 * Zero runtime deps — pure TypeScript constants and functions consumed by both
 * the web PGN parser (apps/web/src/lib/board/pgn-parser.ts) and the API's
 * server-side repertoire tree builder (apps/api/src/repertoire/repertoire-tree.ts).
 *
 * Chess.js is intentionally absent here. Callers inject it via the
 * `walkMoveVariation` factory so this package stays dep-free.
 */

export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

function isWordChar(c: string): boolean {
  return /[A-Za-z0-9.=+#/-]/.test(c);
}

/**
 * Splits movetext into tokens: `(` `)`, whole `{...}` comments, `$N` NAGs,
 * inline glyphs (`!`, `??`, …), move numbers, SAN words, result markers.
 * `;` line comments and whitespace are skipped.
 *
 * This is the superset tokenizer (includes `;` and `!?` glyphs); the API's
 * former compact `tokenize` is a strict subset — adopting the full version is
 * additive and backward-compatible.
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

/**
 * Per-frame callbacks injected by the caller into `walkMoveVariation`.
 *
 * Each factory call creates one chess instance for one variation frame;
 * sub-variations create their own frames by re-invoking the factory.
 */
export interface MoveVariationCallbacks<N> {
  /** Apply `tok` to the frame's chess position; return move data or null. */
  tryMove(tok: string): { fen: string; san: string; uci: string } | null;
  /** Construct a new node of the caller's concrete type. */
  makeNode(fen: string, san: string, uci: string): N;
  /** Handle a `{...}` comment block; caller may extract shapes/prose. */
  onComment(node: N, raw: string): void;
  /** Set a NAG on a node (via callback so the generic never writes N["nag"]). */
  onNag(node: N, nag: number): void;
}

/**
 * Generic PGN movetext walker. Consumes `tokens` (mutating via shift) and
 * appends child nodes to `parentNode`. Sub-variations (`(...)`) recursively
 * create independent frames via the factory.
 *
 * @param tokens  Flat token list from `tokenizeMovetext`, consumed in-place.
 * @param parentNode  Node whose children the current variation populates.
 * @param factory  Called once per variation frame with the starting FEN;
 *                 returns the move/node/comment/nag callbacks for that frame.
 * @param fen  Starting position FEN for this variation frame.
 */
export function walkMoveVariation<
  N extends { fen: string; san: string; uci: string; children: N[]; nag?: number },
>(
  tokens: string[],
  parentNode: N,
  factory: (startFen: string) => MoveVariationCallbacks<N>,
  fen: string,
): void {
  const f = factory(fen);
  let prev: N = parentNode;
  let anchor: N = parentNode;

  while (tokens.length > 0) {
    const tok = tokens.shift()!;

    if (tok === ')') return;

    if (tok === '(') {
      // Alternative to prev's move — branch from anchor's position.
      walkMoveVariation(tokens, anchor, factory, anchor.fen);
      continue;
    }

    if (tok.startsWith('{')) {
      if (prev !== parentNode) {
        const raw = tok.replace(/^\{/, '').replace(/\}$/, '').trim();
        f.onComment(prev, raw);
      }
      continue;
    }

    if (tok.startsWith('$')) {
      const n = Number.parseInt(tok.slice(1), 10);
      if (prev !== parentNode && Number.isFinite(n) && prev.nag === undefined) {
        f.onNag(prev, n);
      }
      continue;
    }

    if (GLYPH_NAGS[tok] !== undefined) {
      if (prev !== parentNode && prev.nag === undefined) {
        f.onNag(prev, GLYPH_NAGS[tok]);
      }
      continue;
    }

    if (RESULT_TOKENS.has(tok)) return;

    if (/^\d+\.*$/.test(tok) || /^\.+$/.test(tok)) continue; // move number — skip

    const result = f.tryMove(tok);
    if (!result) continue; // invalid move — skip, keep parsing

    const node = f.makeNode(result.fen, result.san, result.uci);
    prev.children.push(node);
    anchor = prev;
    prev = node;
  }
}
