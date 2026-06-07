'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { GameHistorySummaryDto } from '@purechess/shared';
import { GameHistoryRow } from './game-history-row';

type GameHistoryListProps = {
  games: GameHistorySummaryDto[];
  onLoadMore?: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
};

const TABLE_HEADERS = ['Date', 'Opponent', 'Color', 'Result', 'Rating Δ', 'Time', ''];

function VirtualizedBody({ games }: { games: GameHistorySummaryDto[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: games.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 42,
    overscan: 10,
  });

  const items = rowVirtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="overflow-auto max-h-[600px]">
      <table className="w-full text-left">
        <thead className="sticky top-0 bg-background border-b border-border">
          <tr>
            {TABLE_HEADERS.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                {h}
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
                className="border-b border-border hover:bg-muted/30 transition-colors"
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
    <div className="overflow-auto">
      <table className="w-full text-left">
        <thead className="border-b border-border">
          <tr>
            {TABLE_HEADERS.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                {h}
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
            className="px-4 py-2 text-sm border border-border rounded hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
