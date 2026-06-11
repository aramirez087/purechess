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
  /** Total games matching the filters, from the API (ignores pagination). */
  total?: number;
};

const TABLE_HEADERS = [
  { label: 'Date', className: 'w-24' },
  { label: 'Opponent', className: '' },
  { label: 'Color', className: 'w-16 text-center' },
  { label: 'Result', className: 'w-20' },
  { label: 'Δ', srLabel: 'Rating change', className: 'w-16 text-right' },
  { label: 'Time', className: 'w-20' },
  { label: '', srLabel: 'Review', className: 'w-16' },
];

function LedgerHead({ sticky = false }: { sticky?: boolean }) {
  return (
    <thead
      className={cn(
        'border-b border-border/60 bg-raised/60',
        sticky && 'sticky top-0 z-10 backdrop-blur-sm',
      )}
    >
      <tr>
        {TABLE_HEADERS.map((h, i) => (
          <th
            key={h.label || i}
            scope="col"
            className={cn(
              'whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground',
              h.className,
            )}
          >
            {h.srLabel ? (
              <>
                <span aria-hidden>{h.label}</span>
                <span className="sr-only">{h.srLabel}</span>
              </>
            ) : (
              h.label
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

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
    <div ref={parentRef} className="max-h-[600px] overflow-auto">
      <table className="w-full text-left">
        <LedgerHead sticky />
        <tbody
          style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
        >
          {items.map((vRow) => (
            <GameHistoryRow
              key={vRow.key}
              game={games[vRow.index]}
              data-index={vRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlatBody({ games }: { games: GameHistorySummaryDto[] }) {
  return (
    <table className="w-full text-left">
      <LedgerHead />
      <tbody>
        {games.map((g) => (
          <GameHistoryRow key={g.id} game={g} />
        ))}
      </tbody>
    </table>
  );
}

export function GameHistoryList({
  games,
  onLoadMore,
  hasMore,
  isLoadingMore,
  total,
}: GameHistoryListProps) {
  if (games.length === 0) {
    return null;
  }

  const wins = games.filter((g) => g.result === 'win').length;
  const losses = games.filter((g) => g.result === 'loss').length;
  const draws = games.filter((g) => g.result === 'draw').length;

  // The W-L-D tally is computed from the loaded rows; when more pages remain
  // it only covers the latest games, so it is labelled as such.
  const isPartial = hasMore || (total !== undefined && games.length < total);

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-surface shadow-elevated">
      {games.length > 100 ? <VirtualizedBody games={games} /> : <FlatBody games={games} />}

      <div className="flex items-center justify-between border-t border-border/60 bg-raised/30 px-4 py-2 font-mono text-xs tabular-nums text-muted-foreground">
        <span>
          {total !== undefined
            ? `${total} ${total === 1 ? 'game' : 'games'}`
            : `${games.length} ${games.length === 1 ? 'game' : 'games'}${hasMore ? ' shown' : ''}`}
        </span>
        <span>
          <span aria-hidden="true">
            {isPartial ? `latest ${games.length}: ` : ''}
            {wins}W–{losses}L–{draws}D
          </span>
          <span className="sr-only">
            {isPartial ? `Of the latest ${games.length} games: ` : ''}
            {wins} {wins === 1 ? 'win' : 'wins'}, {losses} {losses === 1 ? 'loss' : 'losses'},{' '}
            {draws} {draws === 1 ? 'draw' : 'draws'}
          </span>
        </span>
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="w-full border-t border-border/60 px-4 py-2.5 text-center font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-raised/40 hover:text-brass disabled:opacity-50"
        >
          {isLoadingMore ? 'Loading…' : 'Load older games'}
        </button>
      )}
    </div>
  );
}
