'use client';

import Link from 'next/link';
import type { PuzzleThemeStatDto } from '@purechess/shared';
import { cn } from '@/lib/utils';
import { accuracyBand, humanizeTheme } from './theme-tile';

/**
 * Per-theme accuracy table, weakest-first. Each row is a deep link into the
 * theme trainer (`/puzzles/train?theme=<slug>`) so a user can practice straight
 * from a weakness. Accuracy is shown as both a number and a horizontal bar
 * tinted with the shared S01 accuracy color scale (red <50 / yellow <70 /
 * green); a "⚠" marks any theme under 50% — never color alone. Themes the user
 * hasn't attempted are filtered out (no accuracy = nothing to drill toward).
 */

interface ThemeAccuracyTableProps {
  stats: PuzzleThemeStatDto[];
  className?: string;
}

/** Accuracy ASC (weakest first); tie-break larger sample, then slug. */
export function sortWeakestFirst(stats: PuzzleThemeStatDto[]): PuzzleThemeStatDto[] {
  return stats
    .filter((s) => s.attempts > 0 && typeof s.accuracy === 'number')
    .slice()
    .sort((a, b) => {
      const aa = a.accuracy as number;
      const ba = b.accuracy as number;
      if (aa !== ba) return aa - ba;
      if (a.attempts !== b.attempts) return b.attempts - a.attempts;
      return a.slug.localeCompare(b.slug);
    });
}

export function ThemeAccuracyTable({ stats, className }: ThemeAccuracyTableProps) {
  const rows = sortWeakestFirst(stats);

  if (rows.length === 0) {
    return (
      <div
        data-testid="theme-accuracy-empty"
        className={cn(
          'rounded-[10px] border border-dashed border-border/70 px-6 py-8 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        Solve a few themed puzzles to see your accuracy by theme.
      </div>
    );
  }

  return (
    <div
      data-testid="theme-accuracy-table"
      className={cn('overflow-hidden rounded-[10px] border border-border/70 bg-surface/60', className)}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <th scope="col" className="px-4 py-2.5 text-left font-medium">
              Theme
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium tabular-nums">
              Solved
            </th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              Accuracy
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const accuracy = s.accuracy as number;
            const pct = Math.round(accuracy * 100);
            const band = accuracyBand(accuracy);
            const low = accuracy < 0.5;
            const name = s.label ?? humanizeTheme(s.slug);
            return (
              <tr
                key={s.slug}
                data-testid="theme-accuracy-row"
                data-slug={s.slug}
                className="border-b border-border/40 last:border-b-0 transition-colors hover:bg-raised"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/puzzles/train?theme=${encodeURIComponent(s.slug)}`}
                    className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-2 hover:text-brass hover:underline"
                  >
                    {low && (
                      <span aria-hidden="true" className="acc-low" title="Below 50% accuracy">
                        ⚠
                      </span>
                    )}
                    {name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                  {s.solved}/{s.attempts}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-2.5">
                    {/* Horizontal accuracy bar — shared S01 color scale. */}
                    <div
                      className="h-1.5 w-20 overflow-hidden rounded-full bg-border/50"
                      role="presentation"
                    >
                      <div
                        data-testid="accuracy-bar"
                        className={cn('h-full rounded-full', `acc-bg-${band}`)}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                    <span
                      className={cn('w-10 text-right font-mono font-medium tabular-nums', `acc-${band}`)}
                    >
                      {pct}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
