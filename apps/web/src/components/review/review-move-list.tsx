'use client';

import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { WireMove } from '@purechess/shared';
import type { ClassifiedMove } from '@/hooks/use-move-classifier';
import { ClassificationBadge } from '@/components/review/classification-badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReviewMoveListProps {
  moves: WireMove[];
  currentPly: number;
  onSeek: (ply: number) => void;
  /** Undefined = classification hasn't run yet — no badges shown. */
  classifications?: ClassifiedMove[];
}

export function ReviewMoveList({ moves, currentPly, onSeek, classifications }: ReviewMoveListProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [currentPly]);

  const byPly = useMemo(() => {
    const map = new Map<number, ClassifiedMove>();
    for (const c of classifications ?? []) map.set(c.ply, c);
    return map;
  }, [classifications]);

  const pairs: Array<[WireMove, WireMove | null]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1] ?? null]);
  }

  return (
    <ScrollArea className="h-48 md:h-64 rounded border border-border">
      <div className="p-2 font-mono text-sm">
        {pairs.map(([white, black], idx) => {
          const whitePly = idx * 2 + 1;
          const blackPly = idx * 2 + 2;
          return (
            <div key={idx} className="flex items-center gap-1 py-0.5">
              <span className="text-muted-foreground w-6 shrink-0">{idx + 1}.</span>
              <button
                ref={currentPly === whitePly ? activeRef : null}
                onClick={() => onSeek(whitePly)}
                className={cn(
                  'px-1.5 py-0.5 rounded hover:bg-accent/20 transition-colors',
                  currentPly === whitePly && 'font-bold bg-accent/10'
                )}
              >
                {white.san}
              </button>
              <ClassificationBadge class={byPly.get(whitePly)?.class} />
              {black && (
                <button
                  ref={currentPly === blackPly ? activeRef : null}
                  onClick={() => onSeek(blackPly)}
                  className={cn(
                    'px-1.5 py-0.5 rounded hover:bg-accent/20 transition-colors',
                    currentPly === blackPly && 'font-bold bg-accent/10'
                  )}
                >
                  {black.san}
                </button>
              )}
              {black && <ClassificationBadge class={byPly.get(blackPly)?.class} />}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
