'use client';

import Link from 'next/link';
import { Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ResultTone = 'win' | 'loss' | 'draw';

/**
 * The big serif word for the result moment. Checkmate keeps its iconic name
 * for both sides; everything else resolves to a verdict word, with the
 * mechanical reason relegated to the small line underneath.
 */
function getTheaterWord(tone: ResultTone, reasonLabel: string | null): string {
  if (reasonLabel === 'Checkmate') return 'Checkmate.';
  if (reasonLabel === 'Stalemate') return 'Stalemate.';
  if (tone === 'win') return 'Victory.';
  if (tone === 'loss') return 'Defeat.';
  return 'Draw.';
}

// Staggered brass sparks for the victory moment — quiet celebration, no
// confetti clutter. Pure CSS; reduced-motion kills the animation.
const SPARKS: Array<{ left: string; top: string; size: number; delay: string }> = [
  { left: '18%', top: '62%', size: 5, delay: '0s' },
  { left: '30%', top: '74%', size: 3, delay: '0.7s' },
  { left: '42%', top: '68%', size: 4, delay: '1.5s' },
  { left: '57%', top: '76%', size: 3, delay: '0.3s' },
  { left: '68%', top: '64%', size: 5, delay: '1.1s' },
  { left: '80%', top: '72%', size: 4, delay: '1.9s' },
  { left: '25%', top: '38%', size: 3, delay: '1.3s' },
  { left: '74%', top: '34%', size: 3, delay: '0.5s' },
];

/**
 * Game-over card rendered on top of the board (via BoardColumn's `overlay`
 * slot). Win tone gets the brass halo + rising sparks. `onRematch` is
 * optional — omit it where rematch isn't available.
 */
export function ResultOverlay({
  tone,
  resultLabel,
  reasonLabel,
  onDismiss,
  onRematch,
}: {
  tone: ResultTone;
  resultLabel: string;
  reasonLabel: string | null;
  onDismiss: () => void;
  onRematch?: () => void;
}) {
  const toneRing: Record<ResultTone, string> = {
    win: 'shadow-[0_28px_90px_-20px_rgba(214,181,99,0.5)]',
    draw: 'shadow-[0_28px_80px_-26px_rgba(0,0,0,0.7)]',
    loss: 'shadow-[0_28px_80px_-26px_rgba(0,0,0,0.7)]',
  };
  const toneWord: Record<ResultTone, string> = {
    win: 'text-[#f3e7c4]',
    draw: 'text-[#e8e4d8]',
    loss: 'text-[#e8e4d8]',
  };
  const toneRule: Record<ResultTone, string> = {
    win: 'via-[#d6b563]/80',
    draw: 'via-[#9da79c]/60',
    loss: 'via-destructive/60',
  };
  return (
    <div data-testid="game-result" className="absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-[10px] bg-[#0b0d0b]/70 p-4 backdrop-blur-[4px]">
      {tone === 'win' && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(214,181,99,0.26) 0%, rgba(214,181,99,0.07) 45%, transparent 70%)',
              animation: 'victory-halo 2.8s ease-out infinite',
            }}
          />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-[#e8cd8a]"
              style={{
                left: s.left,
                top: s.top,
                width: s.size,
                height: s.size,
                boxShadow: '0 0 8px 2px rgba(214,181,99,0.55)',
                animation: `victory-spark 3s ease-in-out ${s.delay} infinite`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}
      <div
        className={cn(
          'animate-rise w-full max-w-[340px] rounded-[14px] border border-[#2b332c]/90 bg-gradient-to-b from-[#171b13] to-[#0d100b] px-6 pb-7 pt-8 text-center',
          toneRing[tone],
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#9da79c]">
          {resultLabel}
        </p>
        <p
          className={cn(
            'font-display mt-3 text-[clamp(2.5rem,6vw,3.25rem)] italic leading-none tracking-[-0.01em]',
            toneWord[tone],
          )}
        >
          {getTheaterWord(tone, reasonLabel)}
        </p>
        <div
          aria-hidden
          className={cn(
            'mx-auto mt-4 h-px w-2/3 bg-gradient-to-r from-transparent to-transparent',
            toneRule[tone],
          )}
        />
        {reasonLabel && (
          <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#b9b19d]">
            by {reasonLabel}
          </p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-2.5 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
          >
            View board
          </button>
          {onRematch && (
            <button
              type="button"
              onClick={onRematch}
              className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[#d6b563]/45 bg-[#d6b563]/12 px-2.5 text-sm font-semibold text-[#f3e7c4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#d6b563]/70 hover:bg-[#d6b563]/20 active:translate-y-px active:bg-[#d6b563]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Rematch
            </button>
          )}
          <Link
            href="/play"
            className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-[7px] border border-[#2b332c] bg-[#0b0d0b]/40 px-2.5 text-sm font-medium text-[#c7cfc4] transition-[color,background-color,border-color,transform] duration-150 hover:border-[#3a443b] hover:text-[#f1eee6] active:translate-y-px active:bg-[#0b0d0b]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6b563] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d0b]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New
          </Link>
        </div>
      </div>
    </div>
  );
}
