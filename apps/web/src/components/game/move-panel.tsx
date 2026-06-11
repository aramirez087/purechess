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

// One score-sheet row = text-sm line box (1.25rem — the cells' arbitrary
// font sizes inherit the wrapper's line-height) + py-1 (0.5rem) + 1px
// transparent border. The ruling gradient below must repeat on exactly this
// period to stay on the rows; rem-derived (not px) so browser text scaling
// keeps the hairlines on the rows. The hairline occupies the final 1px.
const ROW_CONTENT_HEIGHT = '1.75rem';

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
      <div className="relative min-h-full">
        {/* Printed score-sheet ruling: hairlines continue past the last move
            and fade out at the bottom of the sheet. Rows draw transparent
            borders so the gradient is the single source of rules. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW_CONTENT_HEIGHT}, rgba(35,42,36,0.55) ${ROW_CONTENT_HEIGHT}, rgba(35,42,36,0.55) calc(${ROW_CONTENT_HEIGHT} + 1px))`,
            WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent)',
            maskImage: 'linear-gradient(to bottom, black calc(100% - 48px), transparent)',
          }}
        />
        {pairs.length === 0 ? (
          <p className="font-display relative px-4 py-5 text-[15px] italic text-[#7f897f]">
            No moves yet.
          </p>
        ) : (
          <table className="relative w-full border-separate border-spacing-0">
            <tbody>
              {pairs.map((p) => {
                const rowActive = currentPly === p.white?.ply || currentPly === p.black?.ply;
                return (
                  <tr key={p.no} ref={rowActive ? activeRef : undefined} data-move-number={p.no}>
                    <td className="w-9 border-b border-transparent py-1 pl-2 pr-2.5 text-right font-mono text-[11px] tabular-nums text-[#8a958a]">
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
  const cellBase = 'w-1/2 border-b border-transparent';

  if (!move) return <td className={cn(cellBase, 'px-2 py-1')} />;

  const active = currentPly === move.ply;

  if (onSeek) {
    return (
      <td className={cellBase}>
        <button
          type="button"
          onClick={() => onSeek(move.ply)}
          aria-current={active ? 'true' : undefined}
          className={cn(
            'block w-full px-2.5 py-1 text-left font-mono text-[13px] tabular-nums transition-colors hover:bg-[#181c17]',
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
        'px-2.5 py-1 font-mono text-[13px] tabular-nums',
        active
          ? 'bg-[#d6b563]/[0.08] text-[#f1eee6] shadow-[inset_2px_0_0_0_#d6b563]'
          : 'text-[#c9c3b2]',
      )}
    >
      {move.san}
    </td>
  );
}
