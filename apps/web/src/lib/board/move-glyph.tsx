/**
 * On-board move-classification badge — the chess.com-style corner glyph that
 * marks the quality of the move that produced the current position. Pure
 * presentation; the classification itself comes from use-move-classifier.
 *
 * Kept board-layer-local (its own union, not imported from the hook) so the
 * board never depends on the analysis hook. The union is structurally equal to
 * the hook's MoveClass, so a ClassifiedMove.class passes straight through.
 */

export type MoveGlyphClass =
  | 'brilliant'
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'forced';

interface GlyphStyle {
  /** Short symbol painted inside the badge. */
  symbol: string;
  /** Badge fill. */
  bg: string;
  /** Symbol/ink color. */
  fg: string;
  /** Human label for assistive tech. */
  label: string;
}

/**
 * Only high-signal classes draw a board badge. `best`/`good`/`forced` resolve
 * to null on purpose — a badge on every reasonable move is the clutter that
 * makes chess.com's board noisy; we surface the moments that change a game.
 */
const GLYPHS: Record<MoveGlyphClass, GlyphStyle | null> = {
  brilliant: { symbol: '!!', bg: '#1aa897', fg: '#04211d', label: 'Brilliant move' },
  best: null,
  good: null,
  forced: null,
  inaccuracy: { symbol: '?!', bg: '#e0a826', fg: '#241a02', label: 'Inaccuracy' },
  mistake: { symbol: '?', bg: '#e0832a', fg: '#241302', label: 'Mistake' },
  blunder: { symbol: '??', bg: '#cf3b35', fg: '#2a0605', label: 'Blunder' },
};

export function moveGlyphStyle(moveClass: MoveGlyphClass): GlyphStyle | null {
  return GLYPHS[moveClass];
}

/**
 * Renders a circular badge overshooting the top-right corner of its square.
 * Sized off `--board-sq-size` so it tracks the board scale exactly, like the
 * legal-move ring. Sits at z-30 (above pieces at z-20).
 */
export function MoveGlyphBadge({ moveClass }: { moveClass: MoveGlyphClass }) {
  const style = GLYPHS[moveClass];
  if (!style) return null;
  return (
    <div
      role="img"
      aria-label={style.label}
      className="pointer-events-none absolute z-30 flex items-center justify-center rounded-full font-bold leading-none"
      style={{
        top: 0,
        right: 0,
        width: 'calc(var(--board-sq-size) * 0.36)',
        height: 'calc(var(--board-sq-size) * 0.36)',
        transform: 'translate(28%, -28%)',
        background: style.bg,
        color: style.fg,
        fontSize: 'calc(var(--board-sq-size) * 0.17)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.45), inset 0 0 0 1.5px rgba(255,255,255,0.28)',
      }}
    >
      {style.symbol}
    </div>
  );
}
