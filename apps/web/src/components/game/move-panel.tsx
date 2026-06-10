'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface MovePanelMove {
  san: string;
  /** 1-based ply index. */
  ply: number;
}

export interface MovePanelProps {
  moves: MovePanelMove[];
  /** Ply to highlight. For a live game, pass the latest ply; for review, the seek position. */
  currentPly?: number;
  /** When provided, cells become clickable (review/replay). Omit for a static live list. */
  onSeek?: (ply: number) => void;
  className?: string;
}

interface MovePair {
  no: number;
  white?: MovePanelMove;
  black?: MovePanelMove;
}

export function MovePanel({ moves, currentPly, onSeek, className }: MovePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLTableRowElement>(null);
  const interactive = typeof onSeek === 'function';

  useEffect(() => {
    if (interactive) {
      activeRef.current?.scrollIntoView?.({ block: 'nearest' });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves.length, currentPly, interactive]);

  const pairs: MovePair[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ no: i / 2 + 1, white: moves[i], black: moves[i + 1] });
  }

  return (
    <div ref={scrollRef} className={cn('h-full overflow-y-auto text-sm', className)}>
      {pairs.length === 0 ? (
        <p className="font-display px-4 py-5 text-[15px] italic text-[#7f897f]">
          No moves yet.
        </p>
      ) : (
        <table className="w-full border-separate border-spacing-0">
          <tbody>
            {pairs.map((p) => {
              const rowActive = currentPly === p.white?.ply || currentPly === p.black?.ply;
              return (
                <tr key={p.no} ref={rowActive ? activeRef : undefined}>
                  <td className="w-10 border-b border-[#232a24]/70 py-1.5 pl-2 pr-2.5 text-right font-mono text-[11px] tabular-nums text-[#6f7a70]">
                    {p.no}.
                  </td>
                  <MoveCell move={p.white} currentPly={currentPly} onSeek={onSeek} />
                  <MoveCell move={p.black} currentPly={currentPly} onSeek={onSeek} />
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MoveCell({
  move,
  currentPly,
  onSeek,
}: {
  move?: MovePanelMove;
  currentPly?: number;
  onSeek?: (ply: number) => void;
}) {
  const cellBase = 'w-1/2 border-b border-[#232a24]/70';

  if (!move) return <td className={cn(cellBase, 'px-2 py-1.5')} />;

  const active = currentPly === move.ply;

  if (onSeek) {
    return (
      <td className={cellBase}>
        <button
          type="button"
          onClick={() => onSeek(move.ply)}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'block w-full px-2.5 py-1.5 text-left font-mono text-[13px] tabular-nums transition-colors hover:bg-[#181c17]',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d6b563]',
            active
              ? 'bg-[#d6b563]/[0.12] text-[#f8f1de] shadow-[inset_2px_0_0_0_#d6b563]'
              : 'text-[#c9c3b2]',
          )}
        >
          {move.san}
        </button>
      </td>
    );
  }

  return (
    <td
      className={cn(
        cellBase,
        'px-2.5 py-1.5 font-mono text-[13px] tabular-nums',
        active
          ? 'bg-[#d6b563]/[0.08] text-[#f1eee6] shadow-[inset_2px_0_0_0_#d6b563]'
          : 'text-[#c9c3b2]',
      )}
    >
      {move.san}
    </td>
  );
}
