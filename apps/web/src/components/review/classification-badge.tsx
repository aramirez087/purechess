import { cn } from '@/lib/utils';
import type { MoveClass } from '@/hooks/use-move-classifier';

const BADGES: Record<MoveClass, { symbol: string; color: string }> = {
  brilliant: { symbol: '!!', color: 'text-emerald-400' },
  best: { symbol: '!', color: 'text-green-400' },
  good: { symbol: '', color: '' },
  forced: { symbol: '', color: '' },
  inaccuracy: { symbol: '?!', color: 'text-yellow-400' },
  mistake: { symbol: '?', color: 'text-orange-400' },
  blunder: { symbol: '??', color: 'text-red-500' },
};

/** Tiny colored glyph after a move's SAN. Renders nothing for good/forced. */
export function ClassificationBadge({ class: moveClass }: { class?: MoveClass }) {
  if (!moveClass) return null;
  const badge = BADGES[moveClass];
  if (!badge.symbol) return null;
  return (
    <span aria-label={moveClass} className={cn('ml-0.5 text-xs', badge.color)}>
      {badge.symbol}
    </span>
  );
}
