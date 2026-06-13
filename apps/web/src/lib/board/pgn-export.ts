/**
 * Serialises an AnalysisNode tree back to PGN with variations, NAGs,
 * comments, and [%cal][%csl] shape annotations.
 *
 * The output is valid PGN that round-trips through parsePgnToTree(): the
 * parser ignores move numbers, so the structure (mainline + variations) plus
 * SAN/NAG/comment/shape data on each node is what survives the trip.
 */
import type { AnalysisNode } from './analysis-tree';
import type { AnnotationColor, ArrowShape, BoardShape, CircleShape } from './annotations';

const COLOR_CODE: Record<AnnotationColor, string> = {
  green: 'G',
  red: 'R',
  yellow: 'Y',
  blue: 'B',
};

/** `[%cal G...][%csl G...]` for a node's shapes — arrows then circles. */
function shapesToPgnComment(shapes: BoardShape[]): string {
  const arrows = shapes.filter((s): s is ArrowShape => s.type === 'arrow');
  const circles = shapes.filter((s): s is CircleShape => s.type === 'circle');
  const parts: string[] = [];
  if (arrows.length) {
    parts.push(`[%cal ${arrows.map((a) => COLOR_CODE[a.color] + a.from + a.to).join(',')}]`);
  }
  if (circles.length) {
    parts.push(`[%csl ${circles.map((c) => COLOR_CODE[c.color] + c.square).join(',')}]`);
  }
  return parts.join('');
}

/**
 * `{ shapes text }` comment block, or '' when the node has neither shapes nor
 * comment text. Shapes are emitted first so they survive a re-parse cleanly.
 */
function buildCommentBlock(node: AnalysisNode): string {
  const shapePart = node.shapes && node.shapes.length ? shapesToPgnComment(node.shapes) : '';
  const text = node.comment ?? '';
  if (!shapePart && !text) return '';
  const inner = shapePart && text ? `${shapePart} ${text}` : shapePart || text;
  return `{ ${inner} }`;
}

/** True when this node will emit a `{ }` block (forces the next move number). */
function hasCommentBlock(node: AnalysisNode): boolean {
  return Boolean((node.shapes && node.shapes.length) || node.comment);
}

/**
 * One move token: number prefix (white always, black only when forced), SAN,
 * `$N` NAG, then the `{ }` comment block.
 */
function moveToken(node: AnalysisNode, white: boolean, fullmove: number, force: boolean): string {
  let s = '';
  if (white) s += `${fullmove}. `;
  else if (force) s += `${fullmove}... `;
  s += node.san;
  if (node.nag) s += ` $${node.nag}`;
  const comment = buildCommentBlock(node);
  if (comment) s += ` ${comment}`;
  return s;
}

/** Fullmove number after a move played by `white` at `fullmove`. */
function nextFullmove(white: boolean, fullmove: number): number {
  return white ? fullmove : fullmove + 1;
}

/**
 * Serialises a line that begins with move node `first` (played at white/full)
 * and continues down its mainline (`children[0]`). A node's `children[1..]`
 * are alternatives to its `children[0]`, so they emit as parenthesised
 * variations right AFTER that mainline move, not after the node itself.
 */
function serializeLine(
  first: AnalysisNode,
  white: boolean,
  fullmove: number,
  force: boolean,
): string {
  const parts: string[] = [moveToken(first, white, fullmove, force)];
  let node = first;
  let w = white;
  let f = fullmove;
  let fc = hasCommentBlock(first);

  while (node.children.length > 0) {
    const main = node.children[0];
    const variations = node.children.slice(1);

    // `main` is played from the position after `node`.
    const mw = !w;
    const mf = nextFullmove(w, f);
    parts.push(moveToken(main, mw, mf, fc));

    // Variations branch off the same position as `main`.
    for (const v of variations) {
      parts.push(`(${serializeLine(v, mw, mf, true)})`);
    }

    // After a variation block or the move's own comment, the next move
    // reprints its number (matters only for black — white always prints it).
    fc = variations.length > 0 || hasCommentBlock(main);
    node = main;
    w = mw;
    f = mf;
  }

  return parts.join(' ');
}

/** Preferred header order (seven-tag roster first), then any extras. */
const HEADER_ORDER = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'SetUp', 'FEN'];

function serializeHeaders(headers: Record<string, string>): string {
  const keys = [
    ...HEADER_ORDER.filter((k) => k in headers),
    ...Object.keys(headers).filter((k) => !HEADER_ORDER.includes(k)),
  ];
  return keys.map((k) => `[${k} "${headers[k]}"]`).join('\n');
}

export function exportTreeToPgn(root: AnalysisNode, headers?: Record<string, string>): string {
  const tags = headers ?? { Event: 'Purechess Analysis', Result: '*' };
  const headerBlock = serializeHeaders(tags);

  // Starting side + move number come from the root position's FEN, so custom
  // start positions number correctly.
  const fields = root.fen.split(' ');
  const startWhite = fields[1] !== 'b';
  const startFullmove = Number.parseInt(fields[5] ?? '1', 10) || 1;

  const movetext =
    root.children.length > 0
      ? serializeLine(root.children[0], startWhite, startFullmove, true).trim()
      : '';

  const result = tags.Result ?? '*';
  const body = movetext ? `${movetext} ${result}` : result;
  return `${headerBlock}\n\n${body}`;
}
