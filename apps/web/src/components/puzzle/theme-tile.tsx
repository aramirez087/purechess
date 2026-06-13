'use client';

import { cn } from '@/lib/utils';

/**
 * Selectable theme card for the trainer's selection screen. Shows the humanized
 * theme name, the puzzle-bank count, and the user's accuracy for that theme
 * (hidden when they've never attempted it). Accuracy is colored via the shared
 * S01 accuracy scale (red <50 / yellow <70 / green) and always paired with the
 * "% accuracy" label — never color alone. An optional brass "Weakest" badge
 * marks the themes surfaced as the user's weak spots.
 */

export interface ThemeTileProps {
  slug: string;
  /** Humanized name; falls back to a humanized slug if omitted. */
  label?: string;
  puzzleCount?: number;
  /** Number of recorded attempts; 0 (or undefined) hides the accuracy figure. */
  attempts?: number;
  /** solved / attempts, 0..1. */
  accuracy?: number;
  weakest?: boolean;
  disabled?: boolean;
  onSelect?: (slug: string) => void;
}

/** camelCase / slug -> "Spaced Title" ("mateIn2" -> "Mate in 2"). */
export function humanizeTheme(theme: string): string {
  const spaced = theme
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Accuracy band suffix for the shared `.acc-*` color scale. */
export function accuracyBand(accuracy: number): 'low' | 'mid' | 'high' {
  if (accuracy < 0.5) return 'low';
  if (accuracy < 0.7) return 'mid';
  return 'high';
}

function formatCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k`;
  return String(count);
}

export function ThemeTile({
  slug,
  label,
  puzzleCount,
  attempts = 0,
  accuracy,
  weakest = false,
  disabled = false,
  onSelect,
}: ThemeTileProps) {
  const name = label ?? humanizeTheme(slug);
  const hasAccuracy = attempts > 0 && typeof accuracy === 'number';
  const band = hasAccuracy ? accuracyBand(accuracy) : null;
  const pct = hasAccuracy ? Math.round(accuracy * 100) : null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect?.(slug)}
      aria-label={`Train ${name}${pct !== null ? `, ${pct}% accuracy` : ''}`}
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-[10px] border border-border bg-surface p-3.5 text-left transition',
        'hover:border-brass/60 hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60',
        disabled && 'cursor-not-allowed opacity-60 hover:border-border hover:bg-surface',
      )}
    >
      {weakest && (
        <span className="absolute right-2.5 top-2.5 rounded-[7px] border border-brass/40 bg-brass-soft/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-brass-text">
          Weakest
        </span>
      )}
      <span className="pr-16 text-sm font-medium text-foreground">{name}</span>
      <div className="flex items-center justify-between gap-2 text-xs">
        {typeof puzzleCount === 'number' ? (
          <span className="font-mono text-muted-foreground">
            {formatCount(puzzleCount)} puzzles
          </span>
        ) : (
          <span />
        )}
        {pct !== null && band !== null && (
          <span className={cn('font-mono font-medium', `acc-${band}`)}>{pct}% accuracy</span>
        )}
      </div>
    </button>
  );
}
