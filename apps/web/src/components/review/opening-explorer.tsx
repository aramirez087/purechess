'use client';

import { useState } from 'react';
import {
  useOpeningExplorer,
  type ExplorerMove,
  type ExplorerSource,
} from '@/hooks/use-opening-explorer';
import { cn } from '@/lib/utils';

export interface OpeningExplorerProps {
  fen: string;
  /** Called with the row's UCI move — caller enters it into the analysis tree. */
  onMove: (uci: string) => void;
  className?: string;
}

const SOURCES: Array<{ key: ExplorerSource; label: string }> = [
  { key: 'lichess', label: 'Lichess' },
  { key: 'masters', label: 'Masters' },
];

/** 18432 → "18k"; counts under 1000 stay raw. */
export function formatGames(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

function MoveRow({ move, onMove }: { move: ExplorerMove; onMove: (uci: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onMove(move.uci)}
      className="flex h-7 w-full items-center gap-2 rounded-[5px] px-2 text-left transition-colors duration-150 hover:bg-[#1a1f1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563]"
    >
      <span className="min-w-[36px] font-mono text-[13px] font-medium text-[#e7e3d6]">
        {move.san}
      </span>
      <span
        aria-hidden="true"
        className="flex h-[6px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#1a1e19]"
      >
        <span style={{ flexGrow: move.whitePercent }} className="bg-[#f0ede5]" />
        <span style={{ flexGrow: move.drawPercent }} className="bg-[#4a524a]" />
        <span style={{ flexGrow: move.blackPercent }} className="bg-[#1a1e19]" />
      </span>
      <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#9da79c]">
        {move.whitePercent}% {move.drawPercent}% {move.blackPercent}%
      </span>
      <span className="min-w-[30px] shrink-0 text-right font-mono text-[11px] tabular-nums text-[#9da79c]">
        {formatGames(move.total)}
      </span>
    </button>
  );
}

/**
 * Inline opening explorer for the analysis board: appears while the position
 * is in book, hides itself (renders null) when out — the caller never needs a
 * conditional. Clicking a row plays that move. The inner container is keyed
 * by FEN so each new book position re-runs the fade-in without remounting the
 * component (the source toggle survives navigation).
 */
export function OpeningExplorer({ fen, onMove, className }: OpeningExplorerProps) {
  const [source, setSource] = useState<ExplorerSource>('lichess');
  const { data, loading } = useOpeningExplorer(fen, source);

  const showSkeleton = loading && !data;
  if (!showSkeleton && !data?.inBook) return null;

  return (
    <div
      key={fen}
      className={cn(
        'animate-fade-in overflow-hidden rounded-[10px] border border-[#2b332c] bg-[#121511]',
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-[#2b332c] px-2 py-1.5">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSource(s.key)}
            aria-pressed={source === s.key}
            className={cn(
              'rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563]',
              source === s.key
                ? 'border border-[#d6b563]/70 bg-[#d6b563]/15 text-[#d6b563]'
                : 'border border-transparent text-[#9da79c] hover:text-[#e7e3d6]',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 p-1.5">
        {showSkeleton
          ? Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="h-7 animate-pulse rounded-[5px] bg-[#1a1f1a]"
              />
            ))
          : data?.moves.map((move) => <MoveRow key={move.uci} move={move} onMove={onMove} />)}
      </div>
    </div>
  );
}
