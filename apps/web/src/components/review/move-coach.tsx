import { moveGlyphStyle } from '@/lib/board/move-glyph';
import type { ClassifiedMove, MoveClass } from '@/hooks/use-move-classifier';

const VERDICT: Record<MoveClass, { headline: string; tone: string }> = {
  brilliant: { headline: 'Brilliant!', tone: '#1aa897' },
  best: { headline: 'Best move', tone: '#7bbf5a' },
  good: { headline: 'Good move', tone: '#9da79c' },
  forced: { headline: 'Forced — only move', tone: '#9da79c' },
  inaccuracy: { headline: 'Inaccuracy', tone: '#e0a826' },
  mistake: { headline: 'Mistake', tone: '#e0832a' },
  blunder: { headline: 'Blunder', tone: '#cf3b35' },
};

const SUBOPTIMAL = new Set<MoveClass>(['inaccuracy', 'mistake', 'blunder']);

/**
 * A coach line for the move that produced the current position: a colored
 * verdict and, when the move fell short, the engine's better move in SAN. Slim
 * banner that updates as the reviewer steps through the game.
 */
export function MoveCoach({
  move,
  bestSan,
}: {
  move: ClassifiedMove | undefined;
  bestSan?: string;
}) {
  if (!move) return null;
  const verdict = VERDICT[move.class];
  const glyph = moveGlyphStyle(move.class);
  const showBest = SUBOPTIMAL.has(move.class) && bestSan && bestSan !== move.san;
  return (
    <div
      className="flex items-center gap-2 rounded-[6px] border-l-2 bg-[#0b0d0b]/40 px-2.5 py-1.5"
      style={{ borderColor: verdict.tone }}
      aria-live="polite"
    >
      <span
        className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none"
        style={
          glyph
            ? { background: glyph.bg, color: glyph.fg }
            : { color: verdict.tone }
        }
        aria-hidden="true"
      >
        {glyph?.symbol ?? '•'}
      </span>
      <span className="min-w-0 truncate text-[13px]">
        <span className="font-semibold" style={{ color: verdict.tone }}>
          {move.san}
        </span>
        <span className="text-[#9da79c]"> — {verdict.headline}</span>
        {showBest && (
          <span className="text-[#9da79c]">
            . Best was <span className="font-medium text-[#d8d2c3]">{bestSan}</span>
          </span>
        )}
      </span>
    </div>
  );
}
