'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GameHistorySummaryDto } from '@purechess/shared';
import { GameHistoryRow } from './game-history-row';
import { cn } from '@/lib/utils';

type GameHistoryListProps = {
  games: GameHistorySummaryDto[];
  onLoadMore?: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
};

const TABLE_HEADERS = [
  { label: 'Date', className: 'w-24' },
  { label: 'Opponent', className: '' },
  { label: 'Color', className: 'w-16 text-center' },
  { label: 'Result', className: 'w-20' },
  { label: 'Rating Δ', className: 'w-20 text-right' },
  { label: 'Time', className: 'w-20' },
  { label: '', className: 'w-16' },
];

function VirtualizedBody({ games }: { games: GameHistorySummaryDto[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: games.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const items = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="max-h-[600px] overflow-auto rounded-lg border border-border/70 bg-surface/60"
    >
      <table className="w-full text-left">
        <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60">
          <tr>
            {TABLE_HEADERS.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={cn(
                  'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
                  h.className,
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
        >
          {items.map((vRow) => {
            const game = games[vRow.index];
            return (
              <tr
                key={vRow.key}
                data-index={vRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${vRow.start}px)`,
                }}
                className="border-b border-border/40 hover:bg-raised/40 transition-colors"
              >
                <GameHistoryRow game={game} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FlatBody({ games }: { games: GameHistorySummaryDto[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-surface/60">
      <table className="w-full text-left">
        <thead className="border-b border-border/60 bg-background/60">
          <tr>
            {TABLE_HEADERS.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={cn(
                  'px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
                  h.className,
                )}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <GameHistoryRow key={g.id} game={g} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GameHistoryList({ games, onLoadMore, hasMore, isLoadingMore }: GameHistoryListProps) {
  if (games.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {games.length > 100 ? (
        <VirtualizedBody games={games} />
      ) : (
        <FlatBody games={games} />
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-md border border-border/70 bg-raised/40 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
